"""Joseph Smith Papers reference records (metadata layer).

josephsmithpapers.org's terms restrict copying their edited transcripts, so
the JSP presence in the vault is built from what is always legitimate:
reference records — series metadata, scope, and direct URLs — plus the drop
folder for any permitted local material, plus the PUBLIC DOMAIN adjacent
corpus (History of the Church, Journal of Discourses, Lucy Mack Smith)
imported into 30 Church History via the fetchers.
"""
from __future__ import annotations

from scripturegraph.context import Ctx
from scripturegraph.util import now_iso
from scripturegraph.vaultgen import md
from scripturegraph.vaultgen.generate import FOLDER_JSP, record_file

_BASE = "https://www.josephsmithpapers.org"

SERIES = [
    ("JSP Documents Series", f"{_BASE}/the-papers/documents",
     "Fifteen volumes of Joseph Smith's correspondence, revelations, minutes, and "
     "other documents, 1828-1844, in chronological order — the documentary core."),
    ("JSP Journals Series", f"{_BASE}/the-papers/journals",
     "Joseph Smith's journals, 1832-1844 (three volumes), including the entries "
     "behind many D&C section settings."),
    ("JSP Histories Series", f"{_BASE}/the-papers/histories",
     "Joseph Smith's histories, 1832-1844, including all firsthand First Vision "
     "accounts and the 1838 history behind Joseph Smith—History."),
    ("JSP Revelations and Translations Series", f"{_BASE}/the-papers/revelations-and-translations",
     "Manuscript revelation books and printer's manuscripts — the earliest texts of "
     "the revelations and the Book of Mormon printer's manuscript facsimiles."),
    ("JSP Administrative Records Series", f"{_BASE}/the-papers/administrative-records",
     "Council of Fifty minutes, Relief Society minute book, and other institutional "
     "records."),
    ("JSP Legal and Business Records Series", f"{_BASE}/the-papers/legal-and-business-records",
     "Court cases and financial-legal papers, including the 1826 and 1830 "
     "proceedings often raised in critical discussions."),
    ("JSP First Vision Accounts", f"{_BASE}/site/accounts-of-the-first-vision",
     "The gateway page collecting all primary and secondhand First Vision accounts "
     "with images and transcripts."),
]


def write_jsp_reference_notes(ctx: Ctx) -> int:
    n = 0
    for title, url, blurb in SERIES:
        fm = {"ownership": "system", "mutable": "ai", "content_type": "source-note",
              "url": url, "authority_category": 5}
        body = (f"# {title}\n\n> [!info] Reference record\n> Metadata-only pointer: the "
                f"Joseph Smith Papers' terms restrict copying their edited transcripts, "
                f"so study happens at the source.\n\n{blurb}\n\n**Read online:** {url}\n\n"
                f"Related: {md.wikilink('Joseph Smith Jr')} · "
                f"{md.wikilink('Church History')} · "
                f"{md.wikilink('Why are there multiple First Vision accounts')}\n")
        if record_file(ctx, f"{FOLDER_JSP}/{title}.md", "source-note", "generator",
                       f"doc:jsp-ref-{n}", md.build_note(fm, body)):
            n += 1
    ctx.db().execute(
        "UPDATE sources SET status='imported', last_imported=?, "
        "coverage='reference records + drop folder' WHERE source_id='joseph-smith-papers'",
        (now_iso(),))
    ctx.db().commit()
    return n
