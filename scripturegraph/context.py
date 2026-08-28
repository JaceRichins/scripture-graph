"""Engine context: root/vault paths, layered config, database handle, logging.

Everything in the engine flows through a Ctx so tests can run against a
temporary root and the CLI can run against the real one. No module reads
global state or assumes a working directory.
"""
from __future__ import annotations

import copy
import os
from pathlib import Path

import yaml

from scripturegraph import ENGINE_DIRNAME, VAULT_DIRNAME
from scripturegraph.util import ensure_dir, now_iso

# --------------------------------------------------------------------- config

DEFAULTS: dict = {
    "mode": "balanced",  # aggressive | balanced | economical
    "automation": {
        "enabled": True,      # master switch for scheduled runs
        "ai_enabled": True,   # allow AI provider calls during scheduled runs
    },
    "budgets": {
        "aggressive": {"nightly_ai_jobs": 80, "weekly_ai_jobs": 150, "daily_usd_cap": 40.0,
                       "job_timeout_sec": 600, "daily_ai_jobs_cap": 200},
        "balanced":   {"nightly_ai_jobs": 30, "weekly_ai_jobs": 60,  "daily_usd_cap": 10.0,
                       "job_timeout_sec": 420, "daily_ai_jobs_cap": 120},
        "economical": {"nightly_ai_jobs": 12, "weekly_ai_jobs": 25,  "daily_usd_cap": 3.0,
                       "job_timeout_sec": 300, "daily_ai_jobs_cap": 40},
    },
    "providers": {
        # enabled: true | false | "auto" (auto = probe once and cache result)
        "claude": {
            "enabled": "auto",
            "exe": None,  # autodetected if None
            "models": {"researcher": "sonnet", "critic": "sonnet", "judge": "sonnet",
                       "librarian": "sonnet", "light": "haiku"},
            "extra_args": [],
        },
        "codex": {
            "enabled": "auto",
            "exe": None,  # autodetected if None
            "model": None,  # None = codex default from ~/.codex/config.toml
            "extra_args": [],
        },
    },
    "pipeline": {
        "researchers": ["claude", "codex"],  # preferred independent researchers
        "judge": "alternate",                # provider name | "alternate"
        "librarian": "auto",                 # provider name | "auto" (first available)
        "schema_retries": 1,
        "cache": True,
        "role_rotation": True,               # swap supporter/skeptic emphasis by job parity
    },
    "embeddings": {"provider": "auto", "batch": 128},  # auto | hash | fastembed | openai
    "index": {
        "shingle_size": 5,
        "shingle_df_cap": 40,          # drop shingles occurring in more verses than this
        "min_shared_shingles": 3,      # verse-pair threshold (2 caught KJV formulas)
        "strong_verse_shingles": 5,    # verse-pair "strong quote" threshold
        "chapter_pair_min_verses": 2,  # chapter-pair needs this many linked verses …
    },
    "links": {
        "max_related_chapters": 12,
        "max_people_per_chapter": 15,
        "max_places_per_chapter": 12,
        "max_topics_per_chapter": 8,
        "max_mentions_listed": 30,
    },
    "coverage": {"variance_target": 12.0, "equalize_batch": 40, "weights": {}},
    "logs": {"retention_days": 21},
    "git": {"auto_commit": True},
    "ask": {"max_passages": 14},
    "study": {"window_minutes": 30, "job_estimate_sec": 540},
    "acquisition": {
        "request_gap_sec": 1.5,            # hard politeness floor for remote fetches
        "conference_from_year": 1971,      # earliest session on churchofjesuschrist.org
        "conference_backfill": True,       # nightly fetches older sessions…
        "conference_sessions_per_night": 4,  # …this many per night until complete
        "gospel_library_backfill": True,   # nightly chapter-apparatus + collections
        "pages_per_night": 350,            # page budget for that nightly work
    },
    "scheduler": {"frequent_hours": 2, "nightly_time": "02:30",
                  "weekly_day": "SUN", "weekly_time": "03:30"},
}


def _deep_merge(base: dict, over: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in (over or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def _env_overrides(cfg: dict) -> dict:
    """SG_A__B__C=value overrides cfg[a][b][c] (case-insensitive keys)."""
    for name, val in os.environ.items():
        if not name.startswith("SG_") or name == "SG_ROOT":
            continue
        path = [p.lower() for p in name[3:].split("__")]
        node = cfg
        for p in path[:-1]:
            node = node.setdefault(p, {})
            if not isinstance(node, dict):
                break
        else:
            leaf = val
            if val.lower() in ("true", "false"):
                leaf = val.lower() == "true"
            else:
                try:
                    leaf = int(val)
                except ValueError:
                    try:
                        leaf = float(val)
                    except ValueError:
                        pass
            node[path[-1]] = leaf
    return cfg


# ----------------------------------------------------------------------- ctx

class Ctx:
    def __init__(self, root: str | Path, create: bool = False):
        self.root = Path(root).resolve()
        self.vault = self.root / VAULT_DIRNAME
        self.engine = self.vault / ENGINE_DIRNAME
        self.config_dir = self.engine / "config"
        self.db_path = self.engine / "database" / "scripturegraph.sqlite3"
        self.jobs_dir = self.engine / "jobs"
        self.logs_dir = self.engine / "logs"
        self.state_dir = self.engine / "state"
        self.cache_dir = self.engine / "cache"
        self.quarantine_dir = self.engine / "quarantine"
        self.embeddings_dir = self.engine / "embeddings"
        self.sources_dir = self.root / "sources"
        self.drop_dir = self.sources_dir / "drop"
        self.downloads_dir = self.sources_dir / "downloads"
        if create:
            for d in (self.engine, self.config_dir, self.db_path.parent, self.jobs_dir,
                      self.logs_dir, self.state_dir, self.cache_dir, self.quarantine_dir,
                      self.embeddings_dir, self.drop_dir, self.downloads_dir):
                ensure_dir(d)
        self.cfg = self._load_config()
        self._db = None
        self._log = None

    # -- config -------------------------------------------------------------
    def _load_config(self) -> dict:
        cfg = copy.deepcopy(DEFAULTS)
        cfg_file = self.config_dir / "config.yaml"
        if cfg_file.exists():
            with open(cfg_file, "r", encoding="utf-8") as f:
                user = yaml.safe_load(f) or {}
            cfg = _deep_merge(cfg, user)
        # secrets/env file (KEY=VALUE lines) loaded into process env if present
        env_file = self.config_dir / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())
        return _env_overrides(cfg)

    def c(self, dotted: str, default=None):
        node = self.cfg
        for part in dotted.split("."):
            if not isinstance(node, dict) or part not in node:
                return default
            node = node[part]
        return node

    def budget(self, key: str):
        mode = self.c("mode", "balanced")
        return self.c(f"budgets.{mode}.{key}")

    # -- db / log -----------------------------------------------------------
    def db(self):
        if self._db is None:
            from scripturegraph.db import connect
            self._db = connect(self.db_path)
        return self._db

    @property
    def log(self):
        if self._log is None:
            from scripturegraph.log import Logger
            self._log = Logger(self.logs_dir, retention_days=self.c("logs.retention_days", 21))
        return self._log

    def close(self):
        if self._db is not None:
            self._db.close()
            self._db = None

    # -- meta / corpus version ----------------------------------------------
    def meta_get(self, key: str, default=None):
        row = self.db().execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
        return row["value"] if row else default

    def meta_set(self, key: str, value) -> None:
        self.db().execute(
            "INSERT INTO meta(key,value) VALUES(?,?) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
        self.db().commit()

    def corpus_version(self) -> int:
        return int(self.meta_get("corpus_version", "0"))

    def bump_corpus_version(self, reason: str) -> int:
        new = self.corpus_version() + 1
        self.db().execute(
            "INSERT INTO corpus_version_log(version, reason, created_at) VALUES(?,?,?)",
            (new, reason, now_iso()))
        self.meta_set("corpus_version", new)
        self.log.info("corpus_version.bump", version=new, reason=reason)
        return new

    # -- location -----------------------------------------------------------
    @classmethod
    def locate(cls, start: str | Path | None = None) -> "Ctx":
        env_root = os.environ.get("SG_ROOT")
        if env_root:
            return cls(env_root)
        cur = Path(start or os.getcwd()).resolve()
        for cand in (cur, *cur.parents):
            pj = cand / "pyproject.toml"
            if pj.exists() and 'name = "scripturegraph"' in pj.read_text(encoding="utf-8", errors="ignore"):
                return cls(cand)
        raise SystemExit(
            "Could not locate the Scripture Graph root. Run from inside the project, "
            "set SG_ROOT, or pass --root.")
