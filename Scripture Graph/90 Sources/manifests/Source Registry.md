---
ownership: system
mutable: ai
content_type: manifest
---

# Source Registry

| Source | Type | Authority | Status | Acquisition |
| --- | --- | --- | --- | --- |
| Standard Works (scriptures-json) | scripture | 1 | **imported** | download |
| Bible Dictionary / Guide to the Scriptures | reference | 2 | **manual_download_required** | drop-folder |
| Gospel Topics essays & entries | reference | 2 | **manual_download_required** | drop-folder |
| General Conference talks | conference | 3 | **imported** | api-fetch |
| Church history materials (e.g. Saints, JS histories) | history | 4 | **manual_download_required** | drop-folder |
| History of the Church (B. H. Roberts ed.) | history | 4 | **available** | download |
| Joseph Smith Papers | jsp | 4 | **imported** | drop-folder |
| Journal of Discourses (1854-1886) | history | 4 | **available** | download |
| Academic scholarship & journals | scholarship | 6 | **manual_download_required** | drop-folder |

## Notes

- **Standard Works (scriptures-json)** — Public-domain scripture text. Auto-downloaded to sources/downloads/scriptures-json.
- **Bible Dictionary / Guide to the Scriptures** — Copyrighted study helps. Drop saved pages into sources/drop/reference/.
- **Gospel Topics essays & entries** — Copyrighted. Taxonomy seeded internally; drop saved pages into sources/drop/reference/.
- **General Conference talks** — Copyrighted; bulk scraping not used. Drop official EPUB/HTML/JSON files into sources/drop/conference/. Vault notes store metadata + citations + brief excerpts; full text stays in the local index only.
- **Church history materials (e.g. Saints, JS histories)** — Drop EPUB/PDF/HTML into sources/drop/history/. Public-domain 19th-century sources welcome.
- **History of the Church (B. H. Roberts ed.)** — Public domain (1902-1912). Compiled/edited narrative; use with documentary care.
- **Joseph Smith Papers** — Site terms prohibit bulk copying. Drop permitted local packages/notes into sources/drop/jsp/. Reference records (title/date/URL) are always allowed.
- **Journal of Discourses (1854-1886)** — Public domain. 26 volumes of reported sermons; reporter accuracy varies — treat as contemporaneous reports, not verbatim transcripts.
- **Academic scholarship & journals** — Drop legally obtained PDFs/HTML into sources/drop/scholarship/.

Authority categories: 1 canon · 2 official Church material · 3 Conference/First Presidency · 4 primary historical sources · 5 documentary editions (JSP) · 6 peer-reviewed scholarship · 7 reputable secondary · 8 other commentary · 9 AI inference. Authority is contextual; see [[SOURCE-POLICY]].
