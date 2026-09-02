"""The hard-question seed pages: every package seed lands on an existing vault
(write-once, on the frequent tick), carries its scope and sg-id, links only
to pages that exist, and registers as a dossier subject."""
import importlib.resources as res
import os
import re

from scripturegraph.bootstrap import install_seed_notes
from scripturegraph.util import read_text
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_QUESTIONS


def _seed_files():
    d = res.files("scripturegraph").joinpath("assets/seed_notes/questions")
    return [e for e in d.iterdir() if e.name.endswith(".md")]


def test_seed_questions_have_scope_and_the_shared_sections():
    seeds = _seed_files()
    assert len(seeds) >= 26, "the LDS + Christian question set"
    scopes = set()
    for e in seeds:
        fm, body = md.parse_note(e.read_text(encoding="utf-8"))
        assert fm["content_type"] == "question"
        assert fm.get("scope") in ("restoration", "christianity"), e.name
        scopes.add(fm["scope"])
        for section in ("concise-answer", "strongest-evidence", "objections",
                        "responses", "assessment", "related", "further-study"):
            assert f"<!-- SG:BEGIN {section} -->" in body, f"{e.name}: {section}"
        assert md.markers_balanced(body), e.name
    assert scopes == {"restoration", "christianity"}, "both arenas are represented"


def test_install_is_write_once_and_stamps_ids(imported_ctx):
    ctx = imported_ctx
    first = install_seed_notes(ctx)
    n_seeds = len(_seed_files())
    assert first["installed"] >= n_seeds
    again = install_seed_notes(ctx)
    assert again["installed"] == 0, "a second tick installs nothing"
    folder = ctx.vault / FOLDER_QUESTIONS
    pages = [p for p in folder.iterdir() if p.suffix == ".md" and p.stem != "Questions"]
    assert len(pages) >= n_seeds
    for p in pages:
        fm, _ = md.parse_note(read_text(p))
        assert fm.get("sg-id", "").startswith("question:"), p.name
    # every page is a node the dossier pass will pick up
    n_nodes = ctx.db().execute(
        "SELECT COUNT(*) AS n FROM nodes WHERE node_type='question' AND vault_path IS NOT NULL"
    ).fetchone()["n"]
    assert n_nodes >= n_seeds
    # a deleted page stays deleted
    victim = pages[0]
    os.remove(victim)
    install_seed_notes(ctx)
    assert not victim.exists(), "the registry remembers deletions"


def test_seed_links_point_at_real_vocabulary(imported_ctx):
    """Wiki-links may only name seeded entities, topics, events, questions or
    scripture chapters — the same rule the researchers are held to."""
    from scripturegraph.booksdata import BOOKS
    ctx = imported_ctx
    db = ctx.db()
    titles = {r["title"] for r in db.execute("SELECT title FROM nodes")}
    titles |= {r["alias"] for r in db.execute("SELECT alias FROM aliases")}
    # the mini fixture imports three books; accept any real chapter title
    chapter_rx = re.compile(r"^(" + "|".join(re.escape(b.title_prefix) for b in BOOKS)
                            + r") \d+$")
    titles |= {e.name[:-3] for e in _seed_files()}
    # the exemplar evidence notes ship alongside (assets/seed_notes/evidence)
    ev = res.files("scripturegraph").joinpath("assets/seed_notes/evidence")
    titles |= {e.name[:-3] for e in ev.iterdir() if e.name.endswith(".md")}
    bad = []
    for e in _seed_files():
        for m in re.findall(r"\[\[([^\]|#]+)", e.read_text(encoding="utf-8")):
            name = " ".join(m.split())
            if name in titles or chapter_rx.match(name):
                continue
            # MOC pages the generator writes (Bible Evidence, Book of Mormon Evidence …)
            if name.endswith(" Evidence") or name == "Joseph Smith—History 1":
                continue
            bad.append((e.name, name))
    assert not bad, bad
