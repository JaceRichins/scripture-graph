"""AI provider adapters — replaceable workers under a deterministic orchestrator.

- ClaudeCLIProvider: `claude -p --output-format json` (headless Claude Code)
- CodexCLIProvider:  `codex exec … --output-last-message <file>`
- StubProvider:      deterministic, schema-valid output derived from job
                     context; keeps the WHOLE pipeline runnable with zero
                     credentials (used by tests and safe-degraded operation)

Availability is probed once and cached in the meta table (re-probed daily).
No business logic lives in provider-specific prompts; prompts are shared,
version-controlled files (see .scripture-engine/config/prompts/).
"""
from __future__ import annotations

import glob
import json
import os
import shutil
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso, sha256_text

_CREATE_NO_WINDOW = 0x08000000


@dataclass
class ProviderResult:
    ok: bool
    text: str = ""
    error: str = ""
    cost_usd: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    duration_s: float = 0.0
    cached: bool = False
    raw: dict = field(default_factory=dict)


def _clean_env() -> dict:
    """Child CLI env: drop nested-session variables that confuse child CLIs."""
    env = dict(os.environ)
    for k in list(env):
        if k.startswith(("CLAUDE_CODE_", "CLAUDECODE", "CLAUDE_PID", "CLAUDE_AGENT")):
            env.pop(k, None)
    return env


class Provider:
    name = "base"

    def __init__(self, ctx: Ctx):
        self.ctx = ctx

    def available(self) -> bool:
        raise NotImplementedError

    def model_for_role(self, role: str) -> str | None:
        return None

    def run(self, prompt: str, role: str, timeout: int, workspace: Path,
            context: dict | None = None) -> ProviderResult:
        raise NotImplementedError

    # ---- shared probe caching ----
    def _probe_cached(self, prober) -> bool:
        cfg = self.ctx.c(f"providers.{self.name}.enabled", "auto")
        if cfg is True:
            return True
        if cfg is False:
            return False
        key = f"probe:{self.name}"
        raw = self.ctx.meta_get(key)
        if raw:
            try:
                data = json.loads(raw)
                if time.time() - data.get("at", 0) < 86400:
                    return bool(data.get("ok"))
            except (json.JSONDecodeError, TypeError):
                pass
        ok = False
        try:
            ok = prober()
        except Exception as e:  # noqa: BLE001
            self.ctx.log.warn(f"provider.{self.name}.probe_error", error=str(e))
        self.ctx.meta_set(key, json.dumps({"ok": ok, "at": time.time()}))
        self.ctx.log.info(f"provider.{self.name}.probe", ok=ok)
        return ok

    def _cache_get(self, model: str, prompt: str) -> ProviderResult | None:
        if not self.ctx.c("pipeline.cache", True):
            return None
        key = sha256_text(f"{self.name}|{model}|{prompt}")
        row = self.ctx.db().execute(
            "SELECT response, cost_usd FROM response_cache WHERE key=?", (key,)).fetchone()
        if row:
            return ProviderResult(ok=True, text=row["response"], cost_usd=0.0, cached=True)
        return None

    def _cache_put(self, model: str, prompt: str, result: ProviderResult) -> None:
        if not self.ctx.c("pipeline.cache", True) or not result.ok:
            return
        key = sha256_text(f"{self.name}|{model}|{prompt}")
        self.ctx.db().execute(
            "INSERT OR REPLACE INTO response_cache(key,provider,model,response,cost_usd,created_at) "
            "VALUES(?,?,?,?,?,?)",
            (key, self.name, model, result.text, result.cost_usd, now_iso()))
        self.ctx.db().commit()


# --------------------------------------------------------------- Claude CLI

def _newest_by_version(candidates: list[str]) -> str:
    def verkey(path: str):
        parts = Path(path).parent.name.split(".")
        return tuple(int(x) if x.isdigit() else 0 for x in parts)
    return max(candidates, key=verkey)


def resolve_claude_exe(ctx: Ctx) -> str | None:
    override = ctx.c("providers.claude.exe")
    if override and Path(override).exists():
        return override
    p = shutil.which("claude")
    if p:
        return p
    localappdata = os.environ.get("LOCALAPPDATA", "")
    appdata = os.environ.get("APPDATA", "")
    # Store/MSIX installs FIRST: %APPDATA%\Claude\... is a virtualized redirect
    # into the app container. From outside it looks like a real file — it even
    # passes exists() — but Windows refuses to execute it, so preferring it
    # leaves the provider permanently "found but broken".
    patterns = [
        os.path.join(localappdata, "Packages", "Claude_*", "LocalCache",
                     "Roaming", "Claude", "claude-code", "*", "claude.exe"),
        os.path.join(appdata, "Claude", "claude-code", "*", "claude.exe"),
    ]
    for pattern in patterns:
        candidates = glob.glob(pattern)
        if candidates:
            return _newest_by_version(candidates)
    return None


class ClaudeCLIProvider(Provider):
    name = "claude"

    def __init__(self, ctx: Ctx):
        super().__init__(ctx)
        self.exe = resolve_claude_exe(ctx)

    def model_for_role(self, role: str) -> str:
        return self.ctx.c(f"providers.claude.models.{role}",
                          self.ctx.c("providers.claude.models.researcher", "sonnet"))

    def available(self) -> bool:
        if self.exe is None:
            return False
        return self._probe_cached(self._probe)

    def _probe(self) -> bool:
        r = self._invoke("Reply with exactly: OK", model="haiku", timeout=90)
        return r.ok and bool(r.text.strip())

    def _invoke(self, prompt: str, model: str, timeout: int,
                workspace: Path | None = None) -> ProviderResult:
        cmd = [self.exe, "-p", "--output-format", "json", "--model", model,
               *[str(a) for a in self.ctx.c("providers.claude.extra_args", [])]]
        t0 = time.time()
        try:
            cp = subprocess.run(
                cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=timeout, env=_clean_env(),
                cwd=str(workspace) if workspace else None,
                creationflags=_CREATE_NO_WINDOW)
        except subprocess.TimeoutExpired:
            return ProviderResult(ok=False, error=f"timeout after {timeout}s",
                                  duration_s=time.time() - t0)
        dur = time.time() - t0
        out = (cp.stdout or "").strip()
        try:
            data = json.loads(out)
        except json.JSONDecodeError:
            if cp.returncode == 0 and out:
                return ProviderResult(ok=True, text=out, duration_s=dur)
            return ProviderResult(ok=False, error=(cp.stderr or out or "no output")[:500],
                                  duration_s=dur)
        if data.get("is_error"):
            return ProviderResult(ok=False, error=str(data.get("result"))[:500],
                                  duration_s=dur, raw=data)
        usage = data.get("usage") or {}
        return ProviderResult(
            ok=True, text=str(data.get("result") or ""), cost_usd=data.get("total_cost_usd"),
            input_tokens=usage.get("input_tokens"), output_tokens=usage.get("output_tokens"),
            duration_s=dur, raw=data)

    def run(self, prompt: str, role: str, timeout: int, workspace: Path,
            context: dict | None = None) -> ProviderResult:
        model = self.model_for_role(role)
        cached = self._cache_get(model, prompt)
        if cached:
            return cached
        result = self._invoke(prompt, model=model, timeout=timeout, workspace=workspace)
        self._cache_put(model, prompt, result)
        return result


# ---------------------------------------------------------------- Codex CLI

def resolve_codex_exe(ctx: Ctx) -> str | None:
    override = ctx.c("providers.codex.exe")
    if override and Path(override).exists():
        return override
    p = shutil.which("codex")
    if p:
        return p
    localappdata = os.environ.get("LOCALAPPDATA", "")
    candidates = glob.glob(os.path.join(localappdata, "OpenAI", "Codex", "bin", "*", "codex.exe"))
    if candidates:
        return max(candidates, key=lambda c: os.path.getmtime(c))
    return None


class CodexCLIProvider(Provider):
    name = "codex"

    def __init__(self, ctx: Ctx):
        super().__init__(ctx)
        self.exe = resolve_codex_exe(ctx)

    def model_for_role(self, role: str) -> str:
        return self.ctx.c("providers.codex.model") or "default"

    def available(self) -> bool:
        if self.exe is None:
            return False
        return self._probe_cached(self._probe)

    def _probe(self) -> bool:
        ws = self.ctx.cache_dir / "codex-probe"
        ws.mkdir(parents=True, exist_ok=True)
        r = self._invoke("Reply with exactly: OK", timeout=120, workspace=ws)
        return r.ok and bool(r.text.strip())

    def _invoke(self, prompt: str, timeout: int, workspace: Path) -> ProviderResult:
        workspace.mkdir(parents=True, exist_ok=True)
        outfile = workspace / f"last-message-{os.getpid()}-{int(time.time() * 1000)}.txt"
        cmd = [self.exe, "exec", "--skip-git-repo-check", "-C", str(workspace),
               "--output-last-message", str(outfile)]
        model = self.ctx.c("providers.codex.model")
        if model:
            cmd += ["-m", str(model)]
        cmd += [str(a) for a in self.ctx.c("providers.codex.extra_args", [])]
        cmd += ["-"]
        t0 = time.time()
        try:
            cp = subprocess.run(
                cmd, input=prompt, capture_output=True, text=True, encoding="utf-8",
                errors="replace", timeout=timeout, env=_clean_env(),
                cwd=str(workspace), creationflags=_CREATE_NO_WINDOW)
        except subprocess.TimeoutExpired:
            outfile.unlink(missing_ok=True)
            return ProviderResult(ok=False, error=f"timeout after {timeout}s",
                                  duration_s=time.time() - t0)
        dur = time.time() - t0
        text = ""
        if outfile.exists():
            text = outfile.read_text(encoding="utf-8", errors="replace").strip()
            outfile.unlink(missing_ok=True)
        if not text and cp.returncode == 0:
            text = (cp.stdout or "").strip()
        if not text:
            return ProviderResult(ok=False, error=(cp.stderr or "no output")[:500], duration_s=dur)
        return ProviderResult(ok=True, text=text, duration_s=dur)

    def run(self, prompt: str, role: str, timeout: int, workspace: Path,
            context: dict | None = None) -> ProviderResult:
        model = self.model_for_role(role)
        cached = self._cache_get(model, prompt)
        if cached:
            return cached
        result = self._invoke(prompt, timeout=timeout, workspace=workspace)
        self._cache_put(model, prompt, result)
        return result


# ---------------------------------------------------------------- Stub

class StubProvider(Provider):
    """Deterministic stand-in that produces schema-valid artifacts from the
    structured job context. Lets the full pipeline (researchers → critique →
    judge → librarian → git) run and be tested with zero credentials."""
    name = "stub"

    def available(self) -> bool:
        return True

    def run(self, prompt: str, role: str, timeout: int, workspace: Path,
            context: dict | None = None) -> ProviderResult:
        context = context or {}
        if role in ("researcher", "critic", "judge"):
            fn = {"researcher": self._research, "critic": self._critique,
                  "judge": self._judge}[role]
            return ProviderResult(ok=True, text=json.dumps(fn(context), ensure_ascii=False))
        return ProviderResult(ok=True, text="{}")

    def _research(self, context: dict) -> dict:
        claims = []
        verses = context.get("verses") or []
        parallels = context.get("parallels") or []
        if verses:
            v = verses[0]
            claims.append({
                "id": "c1", "type": "observation",
                "text": f"The chapter opens with the verse beginning "
                        f"\"{v['text'][:60]}…\" — a structural marker worth noting.",
                "scripture_refs": [v["ref"]],
                "quotes": [{"ref": v["ref"], "quote": v["text"][:120]}],
                "confidence": 0.9, "suggested_tier": "TENTATIVE"})
        for i, p in enumerate(parallels[:2]):
            claims.append({
                "id": f"p{i}", "type": "connection",
                "text": f"This chapter shares verbatim phrasing with {p['other']} "
                        f"({p['n']} parallel verses found by exact text overlap).",
                "scripture_refs": [p["other"]],
                "confidence": 0.95, "suggested_tier": "ACCEPT"})
        return {"claims": claims, "candidate_links": [],
                "topics": context.get("topic_titles", [])[:2],
                "people": [], "places": [], "events": [],
                "study_sections": {}, "uncertainties": ["stub provider output"],
                "counterarguments": []}

    def _critique(self, context: dict) -> dict:
        proposal = context.get("proposal") or {}
        assessments = []
        for c in proposal.get("claims", []):
            has_ref = bool(c.get("scripture_refs"))
            assessments.append({
                "claim_id": c.get("id", "?"),
                "verdict": "affirm" if has_ref else "weaken",
                "reasons": "Citation present and mechanically checkable."
                           if has_ref else "No scripture citation offered."})
        return {"assessments": assessments, "overall": "stub critique"}

    def _judge(self, context: dict) -> dict:
        decisions = []
        for cid, v in (context.get("validation") or {}).items():
            if v.get("refs_ok") and v.get("quotes_ok", True):
                outcome = "TENTATIVE"
            else:
                outcome = "REJECT"
            decisions.append({"claim_id": cid, "outcome": outcome,
                              "rationale": "deterministic stub judgment from validation"})
        return {"decisions": decisions, "link_decisions": [], "section_approvals": {}}


# ---------------------------------------------------------------- registry

_instances: dict[tuple[int, str], Provider] = {}

PROVIDER_CLASSES = {"claude": ClaudeCLIProvider, "codex": CodexCLIProvider,
                    "stub": StubProvider}


def get_provider(ctx: Ctx, name: str) -> Provider:
    key = (id(ctx), name)
    if key not in _instances:
        cls = PROVIDER_CLASSES.get(name)
        if cls is None:
            raise KeyError(f"unknown provider {name!r}")
        _instances[key] = cls(ctx)
    return _instances[key]


def available_providers(ctx: Ctx, include_stub: bool = False) -> list[Provider]:
    out = []
    for name in ("claude", "codex"):
        p = get_provider(ctx, name)
        if p.available():
            out.append(p)
    if include_stub:
        out.append(get_provider(ctx, "stub"))
    return out


def any_provider_available(ctx: Ctx) -> bool:
    return len(available_providers(ctx)) > 0
