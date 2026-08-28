"""Shared fixtures: a miniature but structurally real Scripture Graph root."""
from __future__ import annotations

import json

import pytest

from scripturegraph.context import Ctx
from scripturegraph import gitops

ISA_53_3 = ("He is despised and rejected of men; a man of sorrows, and acquainted "
            "with grief: and we hid as it were our faces from him; he was despised, "
            "and we esteemed him not.")

MINI_CONFIG = """\
mode: economical
bootstrap:
  strict_import: false
  min_chunks: 1
  ai_jobs: 0
providers:
  claude: {enabled: false}
  codex: {enabled: false}
embeddings:
  provider: hash
logs:
  retention_days: 2
"""


def _mini_volumes(src_dir):
    src_dir.mkdir(parents=True, exist_ok=True)
    bom = {"title": "Book of Mormon", "books": [
        {"book": "1 Nephi", "lds_slug": "1-ne", "chapters": [
            {"chapter": 1, "verses": [
                {"verse": 1, "text": "I, Nephi, having been born of goodly parents, "
                                     "therefore I was taught somewhat in all the learning "
                                     "of my father; and I make a record of my proceedings "
                                     "in my days."},
                {"verse": 2, "text": "Yea, I make a record in the language of my father, "
                                     "which consists of the learning of the Jews and the "
                                     "language of the Egyptians."},
                {"verse": 3, "text": "And I know that the record which I make is true; and "
                                     "I make it with mine own hand; and I make it according "
                                     "to my knowledge, having dwelt at Jerusalem in all my days."},
            ]},
            {"chapter": 3, "verses": [
                {"verse": 7, "text": "And it came to pass that I, Nephi, said unto my "
                                     "father: I will go and do the things which the Lord "
                                     "hath commanded, for I know that the Lord giveth no "
                                     "commandments unto the children of men, save he shall "
                                     "prepare a way for them that they may accomplish the "
                                     "thing which he commandeth them."},
                {"verse": 8, "text": "And it came to pass that when my father had heard "
                                     "these words he was exceedingly glad, for he knew that "
                                     "I had been blessed of the Lord; and he said: repent, "
                                     "repent, repent ye and be baptized."},
            ]},
        ]},
        {"book": "Mosiah", "lds_slug": "mosiah", "chapters": [
            {"chapter": 14, "verses": [
                {"verse": 3, "text": ISA_53_3},
                {"verse": 4, "text": "Surely he has borne our griefs, and carried our "
                                     "sorrows; yet we did esteem him stricken, smitten of "
                                     "God, and afflicted."},
            ]},
        ]},
    ]}
    ot = {"title": "Old Testament", "books": [
        {"book": "Isaiah", "lds_slug": "isa", "chapters": [
            {"chapter": 53, "verses": [
                {"verse": 3, "text": ISA_53_3},
                {"verse": 4, "text": "Surely he hath borne our griefs, and carried our "
                                     "sorrows: yet we did esteem him stricken, smitten of "
                                     "God, and afflicted."},
            ]},
        ]},
    ]}
    (src_dir / "book-of-mormon.json").write_text(json.dumps(bom), encoding="utf-8")
    (src_dir / "old-testament.json").write_text(json.dumps(ot), encoding="utf-8")


@pytest.fixture
def mini_ctx(tmp_path):
    root = tmp_path / "SG"
    root.mkdir()
    (root / "pyproject.toml").write_text('[project]\nname = "scripturegraph"\n')
    ctx = Ctx(root, create=True)
    (ctx.config_dir / "config.yaml").write_text(MINI_CONFIG, encoding="utf-8")
    _mini_volumes(ctx.downloads_dir / "scriptures-json")
    ctx = Ctx(root)  # reload with config
    gitops.ensure_repo(ctx)
    yield ctx
    ctx.close()


@pytest.fixture
def imported_ctx(mini_ctx):
    """mini_ctx with scriptures imported + vault generated + entities seeded."""
    from scripturegraph.corpus.scriptures import import_standard_works
    from scripturegraph.indexing.entities import ensure_entities
    from scripturegraph.vaultgen.generate import generate_framework, generate_scriptures
    import_standard_works(mini_ctx, strict=False)
    mini_ctx.bump_corpus_version("test import")
    generate_framework(mini_ctx)
    generate_scriptures(mini_ctx)
    ensure_entities(mini_ctx)
    gitops.commit_all(mini_ctx, "test: baseline")
    return mini_ctx
