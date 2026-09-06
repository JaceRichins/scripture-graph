"""Words of the Prophets: the Teachings volumes are registered Gospel Library
collections, the public-domain book list and periodical issue parsing are
sound, the blessings page renders from indexed text, and the JSP folder
migrates into the new shelf."""
from scripturegraph.corpus import prophets
from scripturegraph.corpus.glib import COLLECTIONS
from scripturegraph.util import read_text
from scripturegraph.vaultgen.generate import FOLDER_JSP, FOLDER_PROPHETS


def test_teachings_volumes_are_collections():
    keys = [k for k in COLLECTIONS if k.startswith("teachings-")]
    assert len(keys) == 15
    assert COLLECTIONS["teachings-joseph-smith"]["uri"] == "/manual/teachings-joseph-smith"
    assert COLLECTIONS["teachings-ezra-taft-benson"]["uri"].endswith("ezra-taft-benson")
    assert all(COLLECTIONS[k]["folder"].startswith(FOLDER_PROPHETS) for k in keys)


def test_issue_labels_and_gutenberg_trim():
    label, date = prophets._issue_label("The Seer", "per_utah-and-the-mormons_the-seer_1853-05_1_5")
    assert label == "The Seer 1853-05 (Vol. 1 No. 5)" and date == "1853-05"
    text = "junk\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nBody.\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nmore"
    assert prophets._clean_gutenberg(text) == "Body."
    assert len(prophets.BOOKS) >= 9 and all(len(b) == 5 for b in prophets.BOOKS)


def test_blessings_note_gathers_from_indexed_sources(imported_ctx):
    from scripturegraph.corpus.universal import store_document
    ctx = imported_ctx
    store_document(ctx, "book:test", prophets.SOURCE_BOOKS, "history", "A Test Book",
                   "Nothing here.\n\n" + "He received a patriarchal blessing under the hands of his father, which said " * 3,
                   author="Someone", date="1880")
    n = prophets.write_blessings_note(ctx)
    assert n == 1
    body = read_text(ctx.vault / prophets.BLESSINGS_NOTE)
    assert "patriarchal blessing" in body and "no living" in body


def test_jsp_folder_migrates_into_words_of_the_prophets(imported_ctx):
    import shutil
    from scripturegraph.vaultgen.migrate import prophets_rename_needed, rename_prophets_folder
    ctx = imported_ctx
    # put the vault on the old shape
    (ctx.vault / FOLDER_JSP).mkdir(parents=True, exist_ok=True)
    (ctx.vault / FOLDER_JSP / "JSP Journals Series.md").write_text("# JSP Journals Series\n", encoding="utf-8")
    old = ctx.vault / "AI Library/20 Joseph Smith Papers"
    shutil.move(str(ctx.vault / FOLDER_JSP), str(old))
    shutil.rmtree(ctx.vault / FOLDER_PROPHETS)
    ctx.db().execute("INSERT INTO file_registry(path,kind,managed_by,node_id,content_hash,updated_at) "
                     "VALUES(?,?,?,?,?,?)", ("AI Library/20 Joseph Smith Papers/JSP Journals Series.md",
                                             "source-note", "generator", None, "x", "now"))
    ctx.db().commit()
    assert prophets_rename_needed(ctx)
    stats = rename_prophets_folder(ctx)
    assert stats["moved"] >= 1 and stats["registry"] == 1 and stats["commit"]
    assert (ctx.vault / FOLDER_JSP / "JSP Journals Series.md").exists()
    assert (ctx.vault / FOLDER_PROPHETS / "Words of the Prophets.md").exists()
    assert rename_prophets_folder(ctx).get("skipped")
