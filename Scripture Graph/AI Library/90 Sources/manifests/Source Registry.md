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
| Conference Reports 1897-1930 (public domain) | conference | 3 | **imported** | download |
| General Conference talks | conference | 3 | **imported** | api-fetch |
| Church history materials (e.g. Saints, JS histories) | history | 4 | **imported** | drop-folder |
| The Evening and the Morning Star (1832-1834) | history | 4 | **available** | download |
| History of the Church (B. H. Roberts ed.) | history | 4 | **imported** | download |
| Joseph Smith Papers | jsp | 4 | **imported** | drop-folder |
| Journal of Discourses (1854-1886) | history | 4 | **imported** | download |
| Latter Day Saints' Messenger and Advocate (Kirtland, 1834-1837) | history | 4 | **available** | download |
| Times and Seasons (Nauvoo, 1839-1846) | history | 4 | **available** | download |
| Academic scholarship & journals | scholarship | 6 | **manual_download_required** | drop-folder |

## Notes

- **Standard Works (scriptures-json)** — Public-domain scripture text. Auto-downloaded to sources/downloads/scriptures-json.
- **Bible Dictionary / Guide to the Scriptures** — Copyrighted study helps. Drop saved pages into sources/drop/reference/.
- **Gospel Topics essays & entries** — Copyrighted. Taxonomy seeded internally; drop saved pages into sources/drop/reference/.
- **General Conference talks** — Copyrighted; bulk scraping not used. Drop official EPUB/HTML/JSON files into sources/drop/conference/. Vault notes store metadata + citations + brief excerpts; full text stays in the local index only.
- **Church history materials (e.g. Saints, JS histories)** — Drop EPUB/PDF/HTML into sources/drop/history/. Public-domain 19th-century sources welcome.
- **The Evening and the Morning Star (1832-1834)** — The Church's first newspaper; earliest printings of many revelations later canonized in the Doctrine and Covenants.
- **History of the Church (B. H. Roberts ed.)** — Public domain (1902-1912). Documentary history compiled from Joseph Smith's papers; edited by later hands, so treat wording as the 1902 edition's, not necessarily Joseph Smith's.
- **Joseph Smith Papers** — Site terms prohibit bulk copying. Drop permitted local packages/notes into sources/drop/jsp/. Reference records (title/date/URL) are always allowed.
- **Journal of Discourses (1854-1886)** — Public domain. 26 volumes of reported sermons; reporter accuracy varies — treat as contemporaneous reports, not verbatim transcripts.
- **Latter Day Saints' Messenger and Advocate (Kirtland, 1834-1837)** — Kirtland-era monthly carrying Oliver Cowdery's letters on the Restoration, early doctrinal exposition, and minutes.
- **Times and Seasons (Nauvoo, 1839-1846)** — The Church's Nauvoo-era newspaper, edited for a time by Joseph Smith himself. First printing of many revelations, letters, and discourses, plus the serialized History of Joseph Smith.
- **Academic scholarship & journals** — Drop legally obtained PDFs/HTML into sources/drop/scholarship/.

Authority categories: 1 canon · 2 official Church material · 3 Conference/First Presidency · 4 primary historical sources · 5 documentary editions (JSP) · 6 peer-reviewed scholarship · 7 reputable secondary · 8 other commentary · 9 AI inference. Authority is contextual; see [[SOURCE-POLICY]].
