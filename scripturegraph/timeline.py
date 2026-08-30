"""The Timeline — time as the connective tissue of the whole graph.

A curated chronology of scripture history, honest about its dating the way
the constitution demands: every event carries a dating label —
  traditional  dates carried by long tradition (early Genesis, the Exodus)
  approximate  scholarly ballpark
  internal     the Book of Mormon's own year-markers (its strongest dating)
  historical   externally corroborated dates
Years are integers; negative = BC. Events carry lanes (Old World / New World /
Restoration), categories, importance (1 major / 2 notable / 3 detail), and
wikilink hooks to people, places, and chapters.

Output:
  AI Library/90 Timeline/<span>.md   century anchor pages — "600-501 BC" lists
                                     Jeremiah in Jerusalem AND Lehi in the
                                     wilderness side by side, all wikilinked,
                                     so the graph learns time
  AI Library/90 Timeline/_data.md    the dataset as a fenced JSON block for
                                     the plugin's interactive timeline view
                                     (markdown so Obsidian Sync always carries
                                     it; underscore keeps it out of browsers)
"""
from __future__ import annotations

import json
from pathlib import Path

from .util import atomic_write_text

OUTPUT_SUB = Path("AI Library") / "90 Timeline"

# lane codes: ow = Old World, nw = Book of Mormon lands, rs = Restoration
# categories: prophets rulers wars visions journeys temples records turning
E = dict  # brevity for the table below

# storyline THREADS — the scriptures run concurrent narratives (during
# Mosiah's era the Book of Mormon carries FOUR at once). A thread branches
# from its parent lane and, where the story does, merges back into it.
# Events without a thread ride their lane's main line.
THREADS: list[dict] = [
    {"id": "ow-israel", "lane": "ow", "label": "Northern Kingdom",
     "color": "#e7c06a", "branch": "kingdom-divides", "merges": False},
    {"id": "nw-jaredite", "lane": "nw", "label": "The Jaredites",
     "color": "#9adbc0", "branch": None, "merges": False},
    {"id": "nw-zeniff", "lane": "nw", "label": "Zeniff's colony",
     "color": "#7fd9ad", "branch": "mosiah-zarahemla", "merges": True},
    {"id": "nw-alma", "lane": "nw", "label": "Alma's people",
     "color": "#2ea06b", "branch": "abinadi", "merges": True},
    # the Mulekites branch off an OLD WORLD moment — the fall of Jerusalem —
    # and their dashed split crosses the hemispheres, like the story did
    {"id": "nw-mulek", "lane": "nw", "label": "The Mulekites",
     "color": "#4fc4a4", "branch": "jerusalem-falls", "merges": True},
]

EVENTS: list[dict] = [
    # ---------------- beginnings (traditional era markers) ------------------
    E(id="creation", t="The Creation and Eden", y0=-4000, y1=-4000, lane="ow", imp=1,
      cat=["turning"], dating="traditional", people=["Adam", "Eve"], places=["Eden"],
      chapters=["Genesis 1", "Genesis 2", "Moses 2", "Abraham 4"],
      note="the record of creation opens every account"),
    E(id="fall", t="The Fall of Adam and Eve", y0=-4000, y1=-4000, lane="ow", imp=1,
      cat=["turning"], dating="traditional", people=["Adam", "Eve"], places=["Eden"],
      chapters=["Genesis 3", "Moses 4"], note="mortality begins"),
    E(id="enoch", t="Enoch's city of Zion", y0=-3300, y1=-3000, lane="ow", imp=2,
      cat=["prophets", "visions"], dating="traditional", people=["Enoch"],
      places=["Zion"], chapters=["Moses 7"], note="a whole people taken up"),
    E(id="flood", t="Noah and the Flood", y0=-2350, y1=-2350, lane="ow", imp=1,
      cat=["turning", "prophets"], dating="traditional", people=["Noah"],
      chapters=["Genesis 7", "Genesis 8", "Moses 8"], note="the earth cleansed"),
    E(id="babel", t="The Tower of Babel; the Jaredites depart", y0=-2200, y1=-2200,
      lane="ow", imp=2, cat=["turning", "journeys"], dating="traditional",
      people=["Jared", "Brother of Jared"], places=["Babel"],
      chapters=["Genesis 11", "Ether 1"],
      note="languages confounded — one family is led away toward a promised land"),
    E(id="jaredite-voyage", t="Jaredite barges cross the sea", y0=-2150, y1=-2150,
      lane="nw", thread="nw-jaredite", imp=2, cat=["journeys"], dating="traditional",
      people=["Brother of Jared"], chapters=["Ether 2", "Ether 3", "Ether 6"],
      note="the Lord touches sixteen stones; a nation is planted in the New World"),
    E(id="jaredite-kings", t="The Jaredite kingdom rises and darkens", y0=-2000,
      y1=-700, lane="nw", thread="nw-jaredite", imp=3, cat=["rulers", "wars"],
      dating="traditional", chapters=["Ether 7", "Ether 9", "Ether 10"],
      note="generations of kings, captivity, and secret combinations"),
    E(id="jaredite-end", t="The Jaredites destroy themselves; Coriantumr alone",
      y0=-590, y1=-580, lane="nw", thread="nw-jaredite", imp=2,
      cat=["wars", "turning"], dating="traditional",
      people=["Coriantumr", "Ether"], places=["Ramah"],
      chapters=["Ether 14", "Ether 15", "Omni 1"],
      note="the prophet watches from a cave; the last king lives to be found by the Mulekites"),

    # ---------------- patriarchs -------------------------------------------
    E(id="abraham-call", t="Abraham called out of Ur", y0=-1950, y1=-1950, lane="ow",
      imp=1, cat=["prophets", "journeys"], dating="approximate",
      people=["Abraham", "Sarah"], places=["Ur", "Haran", "Canaan"],
      chapters=["Genesis 12", "Abraham 2"], note="the covenant that names every later covenant"),
    E(id="abraham-isaac", t="The binding of Isaac on Moriah", y0=-1870, y1=-1870,
      lane="ow", imp=2, cat=["prophets", "turning"], dating="approximate",
      people=["Abraham", "Isaac"], places=["Moriah"], chapters=["Genesis 22"],
      note="the similitude offering"),
    E(id="jacob-israel", t="Jacob becomes Israel", y0=-1800, y1=-1800, lane="ow",
      imp=2, cat=["prophets"], dating="approximate", people=["Jacob"],
      places=["Peniel", "Bethel"], chapters=["Genesis 28", "Genesis 32"],
      note="twelve sons; a nation named"),
    E(id="joseph-egypt", t="Joseph sold into Egypt; rises to rule", y0=-1740, y1=-1710,
      lane="ow", imp=1, cat=["turning", "rulers"], dating="approximate",
      people=["Joseph of Egypt"], places=["Egypt"],
      chapters=["Genesis 37", "Genesis 39", "Genesis 41", "Genesis 45"],
      note="betrayal turned to salvation — Israel comes to Egypt"),

    # ---------------- exodus and conquest ----------------------------------
    E(id="moses-birth", t="Moses drawn from the Nile", y0=-1526, y1=-1526, lane="ow",
      imp=2, cat=["prophets"], dating="traditional", people=["Moses"],
      places=["Egypt"], chapters=["Exodus 2"], note="a deliverer hidden in a basket"),
    E(id="burning-bush", t="The burning bush at Horeb", y0=-1446, y1=-1446, lane="ow",
      imp=1, cat=["visions", "prophets"], dating="traditional", people=["Moses"],
      places=["Horeb", "Sinai"], chapters=["Exodus 3", "Moses 1"],
      note="I AM sends a shepherd back to Pharaoh"),
    E(id="exodus", t="The Exodus from Egypt; the Red Sea", y0=-1446, y1=-1446,
      lane="ow", imp=1, cat=["turning", "journeys"], dating="traditional",
      people=["Moses", "Aaron"], places=["Egypt", "Red Sea"],
      chapters=["Exodus 12", "Exodus 14"],
      note="traditional dating; some scholars place it ~1290 BC"),
    E(id="sinai", t="The law given at Sinai", y0=-1446, y1=-1445, lane="ow", imp=1,
      cat=["visions", "records"], dating="traditional", people=["Moses"],
      places=["Sinai"], chapters=["Exodus 19", "Exodus 20"],
      note="the covenant written in stone"),
    E(id="tabernacle", t="The tabernacle raised", y0=-1445, y1=-1445, lane="ow",
      imp=2, cat=["temples"], dating="traditional", people=["Moses", "Aaron"],
      places=["Sinai"], things=["Ark of the Covenant"],
      chapters=["Exodus 40", "Leviticus 9"],
      note="a portable holy place for a moving people"),
    E(id="wilderness", t="Forty years in the wilderness", y0=-1445, y1=-1406,
      lane="ow", imp=2, cat=["journeys"], dating="traditional", people=["Moses"],
      chapters=["Numbers 14", "Deuteronomy 8"], note="a generation schooled by manna"),
    E(id="jordan-crossing", t="Israel crosses the Jordan", y0=-1406, y1=-1406,
      lane="ow", imp=2, cat=["journeys", "turning"], dating="traditional",
      people=["Joshua"], places=["Jordan River", "Gilgal"],
      things=["Ark of the Covenant"],
      chapters=["Joshua 3", "Joshua 4"], note="the waters stand; twelve stones remember"),
    E(id="jericho", t="Jericho falls", y0=-1406, y1=-1406, lane="ow", imp=2,
      cat=["wars"], dating="traditional", people=["Joshua", "Rahab"],
      places=["Jericho"], chapters=["Joshua 6"], note="walls down at a shout"),
    E(id="judges-era", t="The era of the judges", y0=-1380, y1=-1050, lane="ow",
      imp=2, cat=["rulers", "wars"], dating="approximate",
      people=["Deborah", "Gideon", "Samson", "Ruth"],
      chapters=["Judges 4", "Judges 7", "Judges 16", "Ruth 1"],
      note="every man did that which was right in his own eyes"),

    # ---------------- the kingdom ------------------------------------------
    E(id="samuel-called", t="Samuel called as a child", y0=-1090, y1=-1090, lane="ow",
      imp=2, cat=["prophets"], dating="approximate", people=["Samuel", "Eli"],
      places=["Shiloh"], chapters=["1 Samuel 3"], note="speak, for thy servant heareth"),
    E(id="saul-king", t="Saul anointed — Israel takes a king", y0=-1050, y1=-1050,
      lane="ow", imp=2, cat=["rulers", "turning"], dating="approximate",
      people=["Saul", "Samuel"], chapters=["1 Samuel 8", "1 Samuel 10"],
      note="like all the nations"),
    E(id="david-goliath", t="David and Goliath", y0=-1025, y1=-1025, lane="ow",
      imp=1, cat=["wars"], dating="approximate", people=["David", "Goliath", "Saul"],
      places=["Valley of Elah"], chapters=["1 Samuel 17"],
      note="the battle is the LORD's"),
    E(id="david-king", t="David reigns; Jerusalem the capital", y0=-1010, y1=-970,
      lane="ow", imp=1, cat=["rulers"], dating="approximate", people=["David"],
      places=["Jerusalem", "Hebron"], chapters=["2 Samuel 5", "Psalm 23"],
      note="shepherd, psalmist, king — glory and wreckage"),
    E(id="first-temple", t="Solomon builds the first temple", y0=-966, y1=-959,
      lane="ow", imp=1, cat=["temples", "rulers"], dating="approximate",
      people=["Solomon"], places=["Jerusalem"], things=["Ark of the Covenant"],
      chapters=["1 Kings 6", "1 Kings 8"],
      note="the glory fills the house"),
    E(id="kingdom-divides", t="The kingdom divides — Israel and Judah", y0=-931,
      y1=-931, lane="ow", imp=1, cat=["turning", "rulers"], dating="historical",
      people=["Rehoboam", "Jeroboam"], places=["Jerusalem", "Samaria"],
      chapters=["1 Kings 12"], note="ten tribes north, two south"),
    E(id="elijah-carmel", t="Elijah on Carmel; fire answers", y0=-860, y1=-860,
      lane="ow", thread="ow-israel", imp=1, cat=["prophets", "visions"],
      dating="approximate",
      people=["Elijah", "Ahab", "Jezebel"], places=["Mount Carmel"],
      chapters=["1 Kings 18", "1 Kings 19"],
      note="then the still small voice at Horeb"),
    E(id="elisha", t="Elisha's ministry of miracles", y0=-850, y1=-800, lane="ow",
      thread="ow-israel", imp=2, cat=["prophets"], dating="approximate",
      people=["Elisha"],
      chapters=["2 Kings 2", "2 Kings 5", "2 Kings 6"],
      note="they that be with us are more"),
    E(id="amos-hosea", t="Amos and Hosea warn the north", y0=-760, y1=-722, lane="ow",
      thread="ow-israel", imp=3, cat=["prophets"], dating="approximate",
      people=["Amos", "Hosea"],
      places=["Samaria"], chapters=["Amos 5", "Hosea 11"],
      note="justice like waters; love that will not let go"),
    E(id="israel-falls", t="Assyria destroys northern Israel", y0=-722, y1=-722,
      lane="ow", thread="ow-israel", imp=1, cat=["wars", "turning"],
      dating="historical",
      places=["Samaria", "Assyria"], chapters=["2 Kings 17"],
      note="the ten tribes scattered — the 'lost tribes'"),
    E(id="isaiah", t="Isaiah's ministry in Jerusalem", y0=-740, y1=-690, lane="ow",
      imp=1, cat=["prophets", "visions"], dating="approximate",
      people=["Isaiah", "Hezekiah"], places=["Jerusalem"],
      chapters=["Isaiah 6", "Isaiah 53", "2 Kings 19"],
      note="the prophet Nephi quotes most"),
    E(id="hezekiah-siege", t="Jerusalem spared from Sennacherib", y0=-701, y1=-701,
      lane="ow", imp=2, cat=["wars"], dating="historical",
      people=["Hezekiah", "Isaiah", "Sennacherib"], places=["Jerusalem"],
      chapters=["2 Kings 19", "Isaiah 37"], note="the angel and the Assyrian camp"),
    E(id="josiah-reform", t="Josiah's reform; the book found", y0=-622, y1=-622,
      lane="ow", imp=2, cat=["records", "rulers"], dating="historical",
      people=["Josiah", "Huldah"], places=["Jerusalem"], chapters=["2 Kings 22"],
      note="a lost book of the law shakes a kingdom"),

    # ---------------- the exile — and Lehi's departure ---------------------
    E(id="daniel-babylon", t="Daniel taken to Babylon", y0=-605, y1=-605, lane="ow",
      imp=2, cat=["prophets", "turning"], dating="historical",
      people=["Daniel", "Nebuchadnezzar"], places=["Babylon"],
      chapters=["Daniel 1"], note="first deportation — courtiers in exile"),
    E(id="lehi-departs", t="Lehi's family leaves Jerusalem", y0=-600, y1=-600,
      lane="nw", imp=1, cat=["journeys", "prophets", "turning"], dating="traditional",
      people=["Lehi", "Sariah", "Nephi", "Laman"], places=["Jerusalem"],
      chapters=["1 Nephi 1", "1 Nephi 2"],
      note="while Jeremiah preaches and Daniel serves Babylon, a family walks into the desert"),
    E(id="brass-plates", t="Nephi obtains the brass plates", y0=-600, y1=-599,
      lane="nw", imp=1, cat=["records"], dating="traditional",
      people=["Nephi", "Laban", "Zoram"], places=["Jerusalem"],
      things=["Brass Plates", "Sword of Laban"],
      chapters=["1 Nephi 3", "1 Nephi 4"], note="scripture carried to a new world"),
    E(id="liahona-found", t="The Liahona appears at Lehi's tent door", y0=-599,
      y1=-599, lane="nw", imp=2, cat=["journeys"], dating="traditional",
      people=["Lehi"], things=["Liahona"], chapters=["1 Nephi 16"],
      note="a compass that works by faith"),
    E(id="large-plates-made", t="Nephi makes the large plates", y0=-590, y1=-590,
      lane="nw", imp=3, cat=["records"], dating="internal", people=["Nephi"],
      things=["Large Plates of Nephi"], chapters=["1 Nephi 19"],
      note="the full history begins"),
    E(id="small-plates-made", t="Nephi makes the small plates", y0=-570, y1=-570,
      lane="nw", imp=2, cat=["records"], dating="internal", people=["Nephi"],
      things=["Small Plates of Nephi"], chapters=["1 Nephi 9", "2 Nephi 5"],
      note="for a wise purpose he did not yet know"),
    E(id="jeremiah-dungeon", t="Jeremiah in the dungeon", y0=-588, y1=-587, lane="ow",
      imp=2, cat=["prophets"], dating="historical", people=["Jeremiah", "Zedekiah"],
      places=["Jerusalem"], chapters=["Jeremiah 37", "Jeremiah 38"],
      note="the prophet Lehi's contemporaries tried to silence"),
    E(id="jerusalem-falls", t="Babylon destroys Jerusalem and the temple", y0=-586,
      y1=-586, lane="ow", imp=1, cat=["wars", "turning"], dating="historical",
      people=["Nebuchadnezzar", "Zedekiah", "Jeremiah"], places=["Jerusalem", "Babylon"],
      chapters=["2 Kings 25", "Lamentations 1"],
      note="exactly as Lehi and Jeremiah warned"),
    E(id="mulek-voyage", t="Mulek's people escape fallen Jerusalem",
      y0=-586, y1=-580, lane="nw", thread="nw-mulek", imp=2,
      cat=["journeys", "turning"], dating="internal",
      people=["Mulek", "Zedekiah"], places=["Jerusalem", "Zarahemla"],
      chapters=["Omni 1", "Helaman 8"],
      note="a son of Zedekiah slips the sword of Babylon and sails"),
    E(id="coriantumr-zarahemla", t="The last Jaredite found by Mulek's people",
      y0=-575, y1=-575, lane="nw", thread="nw-mulek", imp=3,
      cat=["turning"], dating="approximate",
      people=["Coriantumr"], places=["Zarahemla"],
      chapters=["Omni 1", "Ether 15"],
      note="Coriantumr dwells nine moons among them — two vanished worlds touch"),
    E(id="zarahemla-people", t="Generations at Zarahemla, without records",
      y0=-450, y1=-250, lane="nw", thread="nw-mulek", imp=2,
      cat=["rulers"], dating="internal",
      people=["Zarahemla"], places=["Zarahemla"],
      chapters=["Omni 1", "Mosiah 25"],
      note="wars, a corrupted tongue, and no book to remember by"),
    E(id="lehi-ocean", t="Lehi's family crosses the ocean", y0=-589, y1=-589,
      lane="nw", imp=1, cat=["journeys"], dating="traditional",
      people=["Nephi", "Lehi", "Laman"], places=["Bountiful (Old World)", "Irreantum"],
      chapters=["1 Nephi 17", "1 Nephi 18"],
      note="a ship not after the manner of men"),
    E(id="nephi-separates", t="Nephites and Lamanites divide", y0=-588, y1=-570,
      lane="nw", imp=1, cat=["turning"], dating="internal",
      people=["Nephi", "Laman", "Jacob (BoM)"], places=["Land of Nephi"],
      chapters=["2 Nephi 5"], note="two nations from one family"),
    E(id="ezekiel", t="Ezekiel among the exiles", y0=-593, y1=-570, lane="ow",
      imp=2, cat=["prophets", "visions"], dating="historical", people=["Ezekiel"],
      places=["Babylon"], chapters=["Ezekiel 1", "Ezekiel 37"],
      note="dry bones; two sticks that become one"),
    E(id="daniel-den", t="Daniel in the lions' den", y0=-539, y1=-539, lane="ow",
      imp=2, cat=["prophets"], dating="traditional", people=["Daniel", "Darius"],
      places=["Babylon"], chapters=["Daniel 6"], note="faith that shuts mouths"),
    E(id="cyrus-return", t="Cyrus lets the exiles return", y0=-538, y1=-538,
      lane="ow", imp=1, cat=["turning", "rulers"], dating="historical",
      people=["Cyrus", "Zerubbabel"], places=["Babylon", "Jerusalem"],
      chapters=["Ezra 1"], note="seventy years, as Jeremiah said"),
    E(id="jacob-sherem", t="Jacob teaches; Sherem confounded", y0=-540, y1=-520,
      lane="nw", imp=3, cat=["prophets"], dating="internal",
      people=["Jacob (BoM)", "Sherem"], chapters=["Jacob 4", "Jacob 7"],
      note="the first anti-Christ answered"),
    E(id="plates-handed-down", t="The small plates pass father to son", y0=-544,
      y1=-130, lane="nw", imp=3, cat=["records"], dating="internal",
      people=["Jacob (BoM)", "Enos", "Jarom", "Omni", "Amaleki"],
      things=["Small Plates of Nephi"], chapters=["Jacob 1", "Jarom 1", "Omni 1"],
      note="four centuries of shrinking entries — and unbroken custody"),
    E(id="records-united", t="Amaleki gives the small plates to King Benjamin",
      y0=-130, y1=-130, lane="nw", imp=3, cat=["records"], dating="internal",
      people=["Amaleki", "King Benjamin"],
      things=["Small Plates of Nephi", "Large Plates of Nephi"],
      chapters=["Omni 1", "Words of Mormon 1"],
      note="both record lines now travel together"),
    E(id="ether-plates-found", t="Limhi's men find twenty-four gold plates",
      y0=-122, y1=-122, lane="nw", thread="nw-zeniff", imp=2,
      cat=["records", "journeys"],
      dating="internal", people=["Limhi", "Ammon (of Zarahemla)"],
      things=["Plates of Ether"], chapters=["Mosiah 8", "Mosiah 21"],
      note="a destroyed nation's story, waiting in the ruins"),
    E(id="mosiah-translates", t="Mosiah translates the Jaredite record", y0=-92,
      y1=-92, lane="nw", imp=2, cat=["records", "visions"], dating="internal",
      people=["Mosiah II"], things=["Plates of Ether", "Urim and Thummim"],
      chapters=["Mosiah 28", "Ether 1"],
      note="by the interpreters prepared from the beginning"),
    E(id="second-temple", t="The second temple finished", y0=-516, y1=-516, lane="ow",
      imp=2, cat=["temples"], dating="historical", people=["Zerubbabel", "Haggai", "Zechariah"],
      places=["Jerusalem"], chapters=["Ezra 6", "Haggai 2"],
      note="smaller, and still the house of the LORD"),
    E(id="esther", t="Esther saves her people", y0=-474, y1=-474, lane="ow", imp=2,
      cat=["rulers", "turning"], dating="approximate", people=["Esther", "Mordecai", "Haman"],
      places=["Susa"], chapters=["Esther 4"], note="for such a time as this"),
    E(id="ezra-nehemiah", t="Ezra reads the law; Nehemiah builds the wall",
      y0=-458, y1=-445, lane="ow", imp=2, cat=["records", "turning"],
      dating="historical", people=["Ezra", "Nehemiah"], places=["Jerusalem"],
      chapters=["Ezra 7", "Nehemiah 4", "Nehemiah 8"],
      note="a people rebuilt around a book"),
    E(id="malachi", t="Malachi — the Old Testament closes", y0=-430, y1=-430,
      lane="ow", imp=2, cat=["prophets"], dating="approximate", people=["Malachi"],
      chapters=["Malachi 3", "Malachi 4"],
      note="Elijah promised before the great and dreadful day"),

    # ---------------- between the testaments / Nephite centuries -----------
    E(id="enos-prayer", t="Enos wrestles in prayer", y0=-480, y1=-450, lane="nw",
      imp=2, cat=["visions"], dating="internal", people=["Enos"],
      chapters=["Enos 1"], note="a whole night's hunger for forgiveness"),
    E(id="alexander", t="Alexander conquers the Near East", y0=-332, y1=-323,
      lane="ow", imp=3, cat=["rulers", "wars"], dating="historical",
      places=["Jerusalem", "Egypt"], chapters=[],
      note="Greek becomes the world's language — the tongue of the New Testament"),
    E(id="mosiah-zarahemla", t="Mosiah discovers Zarahemla", y0=-200, y1=-200,
      lane="nw", imp=1, cat=["journeys", "turning"], dating="internal",
      people=["Mosiah I"], places=["Zarahemla"], chapters=["Omni 1"],
      note="Nephites and Mulekites become one people"),
    E(id="maccabees", t="The Maccabean revolt", y0=-167, y1=-160, lane="ow", imp=3,
      cat=["wars"], dating="historical", places=["Jerusalem"], chapters=[],
      note="the temple rededicated — Hanukkah"),
    E(id="zeniff", t="Zeniff's people return to the land of Nephi", y0=-200, y1=-160,
      lane="nw", thread="nw-zeniff", imp=2, cat=["journeys"], dating="internal",
      people=["Zeniff", "Noah (BoM king)"], places=["Land of Nephi", "Lehi-Nephi"],
      chapters=["Mosiah 9"], note="an over-zealous return that ends in bondage"),
    E(id="abinadi", t="Abinadi before King Noah's court", y0=-148, y1=-148,
      lane="nw", thread="nw-zeniff", imp=1, cat=["prophets", "turning"], dating="internal",
      people=["Abinadi", "Noah (BoM king)", "Alma the Elder"],
      places=["Lehi-Nephi"], chapters=["Mosiah 12", "Mosiah 13", "Mosiah 17"],
      note="one convert in the audience changes everything"),
    E(id="alma-waters", t="Alma baptizes at the waters of Mormon", y0=-147, y1=-145,
      lane="nw", thread="nw-alma", imp=1, cat=["turning"], dating="internal",
      people=["Alma the Elder"], places=["Waters of Mormon"], chapters=["Mosiah 18"],
      note="the church of Christ organized in the wilderness"),
    E(id="alma-bondage", t="Alma's people in bondage; burdens made light",
      y0=-145, y1=-121, lane="nw", thread="nw-alma", imp=2, cat=["turning"],
      dating="internal", people=["Alma the Elder", "Amulon"], places=["Helam"],
      chapters=["Mosiah 23", "Mosiah 24"],
      note="the Lord strengthens their backs before opening the way"),
    E(id="limhi-escape", t="Limhi's people escape to Zarahemla", y0=-121, y1=-121,
      lane="nw", thread="nw-zeniff", imp=2, cat=["journeys", "turning"],
      dating="internal", people=["Limhi", "Ammon (of Zarahemla)", "Gideon (BoM)"],
      places=["Zarahemla"], chapters=["Mosiah 22"],
      note="the colony comes home — the storylines rejoin"),
    E(id="alma-deliverance", t="Alma's people delivered to Zarahemla", y0=-120,
      y1=-120, lane="nw", thread="nw-alma", imp=2, cat=["journeys", "turning"],
      dating="internal", people=["Alma the Elder", "Mosiah II"],
      places=["Zarahemla"], chapters=["Mosiah 24"],
      note="all the people of Zarahemla hear all the stories at last"),
    E(id="benjamin-speech", t="King Benjamin's address from the tower", y0=-124,
      y1=-124, lane="nw", imp=1, cat=["rulers", "visions"], dating="internal",
      people=["King Benjamin", "Mosiah II"], places=["Zarahemla"],
      chapters=["Mosiah 2", "Mosiah 3", "Mosiah 4"],
      note="a whole people takes Christ's name"),
    E(id="alma-younger", t="The angel stops Alma the Younger", y0=-100, y1=-100,
      lane="nw", imp=1, cat=["visions", "turning"], dating="internal",
      people=["Alma the Younger", "Sons of Mosiah"], chapters=["Mosiah 27", "Alma 36"],
      note="racked with torment, then snatched — the pattern of rebirth"),
    E(id="judges-begin", t="The reign of the judges begins", y0=-91, y1=-91,
      lane="nw", imp=2, cat=["rulers", "turning"], dating="internal",
      people=["Mosiah II", "Alma the Younger"], places=["Zarahemla"],
      chapters=["Mosiah 29"], note="kings ended by a king's own counsel"),
    E(id="ammon-mission", t="The sons of Mosiah among the Lamanites", y0=-90, y1=-77,
      lane="nw", imp=1, cat=["journeys", "turning"], dating="internal",
      people=["Ammon", "Aaron (BoM)", "Lamoni", "Anti-Nephi-Lehies"],
      places=["Land of Nephi", "Middoni"],
      chapters=["Alma 17", "Alma 18", "Alma 24", "Alma 26"],
      note="enemies become the people who bury their weapons"),
    E(id="anti-nephi-covenant", t="The Anti-Nephi-Lehies bury their swords",
      y0=-84, y1=-77, lane="nw", imp=2, cat=["turning", "visions"],
      dating="internal",
      people=["Anti-Nephi-Lehi", "Anti-Nephi-Lehies", "Ammon", "Lamoni"],
      chapters=["Alma 23", "Alma 24"],
      note="swords buried deeper than graves — a covenant kept unto death"),
    E(id="ammonites-jershon", t="The people of Ammon find refuge in Jershon",
      y0=-77, y1=-77, lane="nw", imp=2, cat=["journeys"], dating="internal",
      people=["Anti-Nephi-Lehies", "Ammon"], places=["Jershon"],
      chapters=["Alma 27"],
      note="converts the Nephites swore to defend"),
    E(id="korihor", t="Korihor demands a sign", y0=-74, y1=-74, lane="nw", imp=3,
      cat=["turning"], dating="internal", people=["Korihor", "Alma the Younger"],
      places=["Zarahemla"], chapters=["Alma 30"],
      note="the anti-Christ's arguments, answered and recorded"),
    E(id="zoramites", t="Alma among the Zoramites; the seed of faith", y0=-74,
      y1=-74, lane="nw", imp=2, cat=["prophets"], dating="internal",
      people=["Alma the Younger", "Amulek", "Zoram (dissenter)"],
      places=["Antionum"], chapters=["Alma 31", "Alma 32", "Alma 34"],
      note="prayer from a tower answered from the dust"),
    E(id="war-chapters", t="The great Nephite-Lamanite wars", y0=-74, y1=-60,
      lane="nw", imp=1, cat=["wars"], dating="internal",
      people=["Captain Moroni", "Helaman (son of Alma)", "Amalickiah", "Teancum", "Pahoran"],
      things=["Title of Liberty"],
      places=["Zarahemla", "Bountiful (BoM)"],
      chapters=["Alma 43", "Alma 46", "Alma 48", "Alma 56", "Alma 58", "Alma 60"],
      note="the Title of Liberty years"),
    E(id="stripling-warriors", t="Helaman's two thousand stripling sons", y0=-66,
      y1=-60, lane="nw", imp=1, cat=["wars"], dating="internal",
      people=["Helaman (son of Alma)", "Ammonite mothers"],
      chapters=["Alma 53", "Alma 56", "Alma 57"],
      note="they did not doubt their mothers knew it"),
    E(id="hagoth", t="Hagoth's ships sail north", y0=-55, y1=-53, lane="nw", imp=3,
      cat=["journeys"], dating="internal", people=["Hagoth"],
      chapters=["Alma 63"], note="ships into the west sea, never heard of more"),
    E(id="gadianton-rise", t="Gadianton's secret combinations rise", y0=-50, y1=-26,
      lane="nw", imp=2, cat=["turning", "wars"], dating="internal",
      people=["Gadianton", "Kishkumen", "Helaman (son of Helaman)"],
      chapters=["Helaman 2", "Helaman 6"],
      note="the quiet conspiracy that outlives every war"),
    E(id="nephi-lehi-prison", t="Nephi and Lehi encircled by fire in prison",
      y0=-30, y1=-30, lane="nw", imp=2, cat=["visions", "prophets"],
      dating="internal", people=["Nephi (son of Helaman)", "Lehi (son of Helaman)"],
      places=["Land of Nephi"], chapters=["Helaman 5"],
      note="three hundred converted in the prison itself"),
    E(id="rome-judea", t="Rome takes Judea", y0=-63, y1=-63, lane="ow", imp=3,
      cat=["rulers", "wars"], dating="historical", places=["Jerusalem"],
      chapters=[], note="Pompey enters Jerusalem — the stage set for the Gospels"),
    E(id="samuel-lamanite", t="Samuel the Lamanite on the wall", y0=-6, y1=-6,
      lane="nw", imp=1, cat=["prophets", "visions"], dating="internal",
      people=["Samuel the Lamanite", "Nephi (son of Helaman II)"],
      places=["Zarahemla"], chapters=["Helaman 13", "Helaman 14", "Helaman 16"],
      note="five years more, and the sign of His birth"),

    # ---------------- the meridian of time ---------------------------------
    E(id="christ-birth", t="The birth of Jesus Christ", y0=-4, y1=-4, lane="ow",
      imp=1, cat=["turning"], dating="traditional",
      people=["Jesus Christ", "Mary", "Joseph (of Nazareth)"],
      places=["Bethlehem"], chapters=["Luke 2", "Matthew 2", "3 Nephi 1"],
      note="a night without darkness in the New World; a star over Bethlehem in the Old"),
    E(id="bom-sign-birth", t="The night without darkness", y0=-4, y1=-4, lane="nw",
      imp=1, cat=["visions", "turning"], dating="internal",
      people=["Nephi (son of Helaman II)"], places=["Zarahemla"],
      chapters=["3 Nephi 1"], note="Samuel's sign fulfilled to the hour"),
    E(id="christ-baptism", t="Jesus baptized in the Jordan", y0=27, y1=27, lane="ow",
      imp=1, cat=["turning"], dating="approximate",
      people=["Jesus Christ", "John the Baptist"], places=["Jordan River"],
      chapters=["Matthew 3", "Mark 1"], note="this is my beloved Son"),
    E(id="sermon-mount", t="The Sermon on the Mount", y0=28, y1=28, lane="ow",
      imp=1, cat=["visions"], dating="approximate", people=["Jesus Christ"],
      places=["Galilee"], chapters=["Matthew 5", "Matthew 6", "Matthew 7"],
      note="the law of the kingdom — repeated at Bountiful"),
    E(id="ministry", t="The mortal ministry in Galilee and Judea", y0=27, y1=30,
      lane="ow", imp=1, cat=["turning"], dating="approximate",
      people=["Jesus Christ", "Peter", "John (apostle)", "Mary Magdalene"],
      places=["Galilee", "Capernaum", "Jerusalem"],
      chapters=["John 6", "Luke 15", "John 11"],
      note="three years that split history in two"),
    E(id="gethsemane-cross", t="Gethsemane, the cross, the tomb", y0=30, y1=30,
      lane="ow", imp=1, cat=["turning"], dating="traditional",
      people=["Jesus Christ", "Peter", "Pilate", "Judas Iscariot"],
      places=["Gethsemane", "Golgotha", "Jerusalem"],
      chapters=["Luke 22", "Matthew 27", "John 19"],
      note="the Atonement wrought — dating traditionally AD 33, scholarly ~30/33"),
    E(id="resurrection", t="The Resurrection", y0=30, y1=30, lane="ow", imp=1,
      cat=["turning", "visions"], dating="traditional",
      people=["Jesus Christ", "Mary Magdalene", "Peter", "Thomas"],
      places=["Jerusalem", "Emmaus"], chapters=["John 20", "Luke 24", "Matthew 28"],
      note="the first fruits of them that slept"),
    E(id="bom-destruction", t="Three days of darkness in the New World", y0=34,
      y1=34, lane="nw", imp=1, cat=["turning"], dating="internal",
      places=["Zarahemla", "Moroni (city)"], chapters=["3 Nephi 8", "3 Nephi 9"],
      note="cities sink and burn at the crucifixion; His voice in the dark"),
    E(id="christ-bountiful", t="The risen Christ visits Bountiful", y0=34, y1=34,
      lane="nw", imp=1, cat=["visions", "turning"], dating="internal",
      people=["Jesus Christ", "Nephi (disciple)"], places=["Bountiful (BoM)"],
      chapters=["3 Nephi 11", "3 Nephi 17", "3 Nephi 18"],
      note="one by one they feel the prints — the Book of Mormon's summit"),
    E(id="pentecost", t="Pentecost — the Spirit poured out", y0=30, y1=30, lane="ow",
      imp=2, cat=["turning"], dating="traditional", people=["Peter"],
      places=["Jerusalem"], chapters=["Acts 2"], note="three thousand in a day"),
    E(id="stephen", t="Stephen the first martyr", y0=34, y1=34, lane="ow", imp=2,
      cat=["turning"], dating="approximate", people=["Stephen", "Saul of Tarsus"],
      places=["Jerusalem"], chapters=["Acts 7"], note="he saw the Son of Man standing"),
    E(id="paul-damascus", t="Saul on the Damascus road", y0=35, y1=35, lane="ow",
      imp=1, cat=["visions", "turning"], dating="approximate",
      people=["Paul", "Ananias"], places=["Damascus"], chapters=["Acts 9"],
      note="the persecutor becomes the apostle"),
    E(id="paul-missions", t="Paul's missionary journeys", y0=46, y1=57, lane="ow",
      imp=1, cat=["journeys"], dating="historical",
      people=["Paul", "Barnabas", "Silas", "Timothy"],
      places=["Antioch", "Athens", "Corinth", "Ephesus"],
      chapters=["Acts 13", "Acts 16", "Acts 17", "Acts 19"],
      note="the gospel crosses into Europe"),
    E(id="jerusalem-council", t="The Jerusalem council", y0=49, y1=49, lane="ow",
      imp=2, cat=["turning"], dating="historical", people=["Peter", "Paul", "James (brother of Jesus)"],
      places=["Jerusalem"], chapters=["Acts 15"],
      note="the door opened to the Gentiles"),
    E(id="zion-society", t="Two centuries of Zion among the Nephites", y0=36, y1=200,
      lane="nw", imp=1, cat=["turning"], dating="internal",
      places=["Zarahemla", "Bountiful (BoM)"], chapters=["4 Nephi 1"],
      note="no contention in the land — the longest peace in scripture"),
    E(id="paul-rome", t="Paul's voyage and Roman imprisonment", y0=59, y1=62,
      lane="ow", imp=2, cat=["journeys"], dating="historical", people=["Paul", "Luke"],
      places=["Malta", "Rome"], chapters=["Acts 27", "Acts 28"],
      note="shipwreck, a viper, and letters from chains"),
    E(id="peter-paul-martyred", t="Peter and Paul martyred under Nero", y0=64, y1=67,
      lane="ow", imp=2, cat=["turning"], dating="approximate",
      people=["Peter", "Paul", "Nero"], places=["Rome"],
      chapters=["2 Timothy 4", "2 Peter 1"], note="I have finished my course"),
    E(id="jerusalem-70", t="Rome destroys Jerusalem and the temple", y0=70, y1=70,
      lane="ow", imp=1, cat=["wars", "turning"], dating="historical",
      places=["Jerusalem"], chapters=["Matthew 24", "Luke 21"],
      note="not one stone upon another, as He said"),
    E(id="john-patmos", t="John's Revelation on Patmos", y0=95, y1=95, lane="ow",
      imp=1, cat=["visions", "records"], dating="approximate",
      people=["John (apostle)"], places=["Patmos"],
      chapters=["Revelation 1", "Revelation 21"],
      note="the last apostle sees the end from the beginning"),

    # ---------------- decline and the long silence -------------------------
    E(id="nephite-decline", t="Pride returns; Zion unravels", y0=201, y1=320,
      lane="nw", imp=2, cat=["turning"], dating="internal",
      chapters=["4 Nephi 1"], note="costly apparel, then churches, then hate"),
    E(id="mormon-leads", t="Mormon takes command at sixteen", y0=326, y1=326,
      lane="nw", imp=1, cat=["wars", "records"], dating="internal",
      people=["Mormon"], chapters=["Mormon 1", "Mormon 2"],
      note="a boy general in a dying nation — and its historian"),
    E(id="mormon-abridges", t="Mormon abridges a thousand years onto gold plates",
      y0=380, y1=384, lane="nw", imp=1, cat=["records"], dating="internal",
      people=["Mormon"],
      things=["Gold Plates", "Large Plates of Nephi", "Small Plates of Nephi"],
      chapters=["Words of Mormon 1", "3 Nephi 5", "Mormon 6"],
      note="he attaches the small plates whole — the wise purpose revealed"),
    E(id="cumorah", t="The last battle at Cumorah", y0=385, y1=385, lane="nw",
      imp=1, cat=["wars", "turning"], dating="internal",
      people=["Mormon", "Moroni (son of Mormon)"], places=["Cumorah"],
      things=["Gold Plates"],
      chapters=["Mormon 6", "Mormon 8"],
      note="a nation ends; a record is buried to speak later"),
    E(id="moroni-alone", t="Moroni wanders alone, finishing the record", y0=385,
      y1=421, lane="nw", imp=1, cat=["records"], dating="internal",
      people=["Moroni (son of Mormon)"],
      things=["Gold Plates", "Plates of Ether"],
      chapters=["Mormon 8", "Ether 12", "Moroni 10"],
      note="he abridges Ether, seals the book, and buries it in Cumorah"),

    # ---------------- the Restoration --------------------------------------
    E(id="first-vision", t="The First Vision", y0=1820, y1=1820, lane="rs", imp=1,
      cat=["visions", "turning"], dating="historical",
      people=["Joseph Smith Jr"], places=["Sacred Grove", "Palmyra"],
      chapters=["Joseph Smith—History 1"],
      note="a boy's spring-morning prayer opens the dispensation"),
    E(id="moroni-visits", t="Moroni appears; the plates shown", y0=1823, y1=1823,
      lane="rs", imp=1, cat=["visions"], dating="historical",
      people=["Joseph Smith Jr", "Moroni (son of Mormon)"], places=["Cumorah", "Palmyra"],
      chapters=["Joseph Smith—History 1"],
      note="the buried record's author returns for it"),
    E(id="plates-received", t="Joseph receives the plates", y0=1827, y1=1827,
      lane="rs", imp=2, cat=["records"], dating="historical",
      people=["Joseph Smith Jr", "Emma Smith"], places=["Cumorah"],
      things=["Gold Plates", "Urim and Thummim"],
      chapters=["Joseph Smith—History 1"], note="four years of schooling first"),
    E(id="translation", t="The translation by gift and power", y0=1829, y1=1829,
      lane="rs", imp=1, cat=["records", "visions"], dating="historical",
      people=["Joseph Smith Jr", "Oliver Cowdery", "Martin Harris"],
      places=["Harmony", "Fayette"],
      things=["Gold Plates", "Urim and Thummim"],
      chapters=["D&C 3", "D&C 10", "Joseph Smith—History 1"],
      note="most of the book in about sixty-five working days"),
    E(id="witnesses", t="The Three and the Eight see the plates", y0=1829, y1=1829,
      lane="rs", imp=2, cat=["visions", "records"], dating="historical",
      people=["Oliver Cowdery", "David Whitmer", "Martin Harris"],
      places=["Fayette"], things=["Gold Plates"],
      chapters=["D&C 17"],
      note="an angel turns the leaves; eleven names sign forever"),
    E(id="priesthood-restored", t="Priesthood restored by John the Baptist",
      y0=1829, y1=1829, lane="rs", imp=1, cat=["turning", "visions"],
      dating="historical", people=["Joseph Smith Jr", "Oliver Cowdery", "John the Baptist"],
      places=["Susquehanna River"], chapters=["D&C 13", "Joseph Smith—History 1"],
      note="authority returns hand to head"),
    E(id="bom-published", t="The Book of Mormon published; the Church organized",
      y0=1830, y1=1830, lane="rs", imp=1, cat=["records", "turning"],
      dating="historical", people=["Joseph Smith Jr", "Oliver Cowdery", "Martin Harris"],
      places=["Palmyra", "Fayette"], things=["Gold Plates"],
      chapters=["D&C 20", "D&C 21"],
      note="Moroni's record speaks from the dust, 1,400 years on"),
    E(id="kirtland-temple", t="The Kirtland Temple; keys restored", y0=1836, y1=1836,
      lane="rs", imp=1, cat=["temples", "visions"], dating="historical",
      people=["Joseph Smith Jr", "Oliver Cowdery", "Elijah", "Moses"],
      places=["Kirtland"], chapters=["D&C 110"],
      note="Moses, Elias, and Elijah — Malachi's promise kept"),
    E(id="liberty-jail", t="Winter in Liberty Jail", y0=1838, y1=1839, lane="rs",
      imp=1, cat=["turning"], dating="historical",
      people=["Joseph Smith Jr", "Hyrum Smith"], places=["Liberty"],
      chapters=["D&C 121", "D&C 122", "D&C 123"],
      note="a prison-temple: peace be unto thy soul"),
    E(id="nauvoo", t="Nauvoo the beautiful", y0=1839, y1=1846, lane="rs", imp=2,
      cat=["temples", "turning"], dating="historical",
      people=["Joseph Smith Jr", "Brigham Young", "Emma Smith"], places=["Nauvoo"],
      chapters=["D&C 124"], note="a city and temple from a swamp"),
    E(id="martyrdom", t="The martyrdom at Carthage", y0=1844, y1=1844, lane="rs",
      imp=1, cat=["turning"], dating="historical",
      people=["Joseph Smith Jr", "Hyrum Smith", "John Taylor"], places=["Carthage"],
      chapters=["D&C 135"], note="sealed with blood"),
    E(id="exodus-west", t="The pioneer exodus west", y0=1846, y1=1847, lane="rs",
      imp=1, cat=["journeys"], dating="historical",
      people=["Brigham Young"], places=["Winter Quarters", "Salt Lake Valley"],
      chapters=["D&C 136"], note="another Israel crosses another wilderness"),
    E(id="slc-temple", t="The Salt Lake Temple dedicated", y0=1893, y1=1893,
      lane="rs", imp=2, cat=["temples"], dating="historical",
      people=["Wilford Woodruff"], places=["Salt Lake City"], chapters=[],
      note="forty years of granite"),
    E(id="od1", t="The Manifesto — Official Declaration 1", y0=1890, y1=1890,
      lane="rs", imp=2, cat=["turning"], dating="historical",
      people=["Wilford Woodruff"], chapters=["Official Declaration 1"],
      note="a course change by revelation"),
    E(id="vision-redemption", t="Vision of the redemption of the dead", y0=1918,
      y1=1918, lane="rs", imp=2, cat=["visions"], dating="historical",
      people=["Joseph F. Smith"], chapters=["D&C 138"],
      note="the spirit world opened weeks before he died"),
    E(id="od2", t="Priesthood extended to all — Official Declaration 2", y0=1978,
      y1=1978, lane="rs", imp=1, cat=["turning"], dating="historical",
      people=["Spencer W. Kimball"], chapters=["Official Declaration 2"],
      note="the long-promised day"),
]

# rough era spans per book slug — powers "tap the era above verse 1"
BOOK_YEARS: dict[str, int] = {
    "gen": -1900, "ex": -1446, "lev": -1445, "num": -1440, "deut": -1406,
    "josh": -1400, "judg": -1200, "ruth": -1150, "1sam": -1050, "2sam": -1000,
    "1kgs": -960, "2kgs": -720, "1chr": -1000, "2chr": -900, "ezra": -458,
    "neh": -445, "esth": -474, "job": -1900, "ps": -1000, "prov": -950,
    "eccl": -940, "song": -950, "isa": -720, "jer": -600, "lam": -586,
    "ezek": -585, "dan": -600, "hosea": -750, "joel": -600, "amos": -760,
    "obad": -580, "jonah": -770, "micah": -730, "nahum": -640, "hab": -610,
    "zeph": -630, "hag": -520, "zech": -518, "mal": -430,
    "matt": 28, "mark": 29, "luke": 28, "john": 29, "acts": 40, "rom": 57,
    "1cor": 55, "2cor": 56, "gal": 53, "eph": 61, "philip": 61, "col": 61,
    "1thes": 51, "2thes": 51, "1tim": 63, "2tim": 66, "titus": 64,
    "philem": 61, "heb": 65, "james": 48, "1pet": 63, "2pet": 66, "1jn": 90,
    "2jn": 90, "3jn": 90, "jude": 68, "rev": 95,
    "1ne": -595, "2ne": -570, "jacob": -530, "enos": -460, "jarom": -400,
    "omni": -280, "wofm": 385, "mosiah": -130, "alma": -85, "hel": -45,
    "3ne": 30, "4ne": 100, "morm": 350, "ether": -2150, "moro": 400,
    "dc": 1831, "od": 1890, "moses": -1446, "abr": -1900, "jsm": 30,
    "jsh": 1823, "aoff": 30,
}

LANE_NAMES = {"ow": "In the Old World", "nw": "In the Book of Mormon lands",
              "rs": "The Restoration"}
DATING_MARK = {"traditional": "traditional dating", "approximate": "approximate",
               "internal": "Book of Mormon internal dating", "historical": "historical"}


def _year_str(y: int) -> str:
    return f"{-y} BC" if y < 0 else f"AD {y}"


def _century_span(y: int) -> tuple[int, int]:
    """the century bucket containing year y: -600 → (-600, -501); 34 → (1, 100)."""
    if y < 0:
        hi = ((-y + 99) // 100) * 100         # 600 for -600..-501
        return (-hi, -(hi - 100) - 1)
    lo = ((max(y, 1) - 1) // 100) * 100 + 1   # 1, 101, 201...
    return (lo, lo + 99)


def _span_title(span: tuple[int, int]) -> str:
    a, b = span
    if b < 0:
        return f"{-a}-{-b} BC"
    return f"AD {a}-{b}"


def build_timeline(ctx) -> dict:
    all_events = merged_events(ctx)
    # sanity: unique ids, sane years
    ids = [e["id"] for e in all_events]
    assert len(ids) == len(set(ids)), "duplicate event ids"
    for e in all_events:
        assert e["y0"] <= e["y1"], e["id"]

    out_root = ctx.vault / OUTPUT_SUB
    by_century: dict[tuple[int, int], list[dict]] = {}
    for e in all_events:
        span = _century_span(e["y0"])
        by_century.setdefault(span, []).append(e)

    spans = sorted(by_century.keys())
    wanted: set[Path] = set()
    for idx, span in enumerate(spans):
        title = _span_title(span)
        events = sorted(by_century[span], key=lambda e: (e["y0"], e["id"]))
        lines = [
            "---",
            "ownership: ai",
            "mutable: engine",
            "content_type: timeline",
            f"span_start: {span[0]}",
            f"span_end: {span[1]}",
            "cssclasses:",
            "- sg-ai",
            "---",
            "",
            f"# {title} — what was happening",
            "",
            "_All the world's scripture history in this century, side by side."
            " Dating honesty: every entry says how its date is known._",
            "",
        ]
        for lane in ("ow", "nw", "rs"):
            lane_events = [e for e in events if e["lane"] == lane]
            if not lane_events:
                continue
            lines.append(f"## {LANE_NAMES[lane]}")
            for e in lane_events:
                year = _year_str(e["y0"]) if e["y0"] == e["y1"] else \
                    f"{_year_str(e['y0'])}–{_year_str(e['y1'])}"
                links = []
                links += [f"[[{p}]]" for p in e.get("people", [])[:4]]
                links += [f"[[{p}]]" for p in e.get("places", [])[:3]]
                links += [f"[[{c}]]" for c in e.get("chapters", [])[:4]]
                tail = f" — {' · '.join(links)}" if links else ""
                lines.append(f"- **{year}** — **{e['t']}** — {e['note']}{tail}"
                             f" *({DATING_MARK[e['dating']]})*")
            lines.append("")
        nav = []
        if idx > 0:
            nav.append(f"[[{_span_title(spans[idx - 1])}|◀ {_span_title(spans[idx - 1])}]]")
        if idx + 1 < len(spans):
            nav.append(f"[[{_span_title(spans[idx + 1])}|{_span_title(spans[idx + 1])} ▶]]")
        if nav:
            lines.append(" · ".join(nav))
        lines.append("")
        out = out_root / f"{title}.md"
        atomic_write_text(out, "\n".join(lines))
        wanted.add(out)

    # dataset for the plugin's interactive view — markdown-wrapped JSON so
    # Obsidian Sync always carries it to every device
    data = {"version": 2, "events": all_events, "book_years": BOOK_YEARS,
            "threads": THREADS}
    data_md = "\n".join([
        "---", "ownership: ai", "mutable: engine", "content_type: timeline-data",
        "---", "",
        "# Timeline data",
        "",
        "_Machine-readable dataset for the timeline view. Edit the engine's",
        "timeline module, not this file._",
        "",
        "```json",
        json.dumps(data, ensure_ascii=False, indent=1),
        "```",
        "",
    ])
    data_path = out_root / "_data.md"
    atomic_write_text(data_path, data_md)
    wanted.add(data_path)

    pruned = 0
    if out_root.exists():
        for p in out_root.rglob("*.md"):
            if p not in wanted:
                p.unlink()
                pruned += 1

    return {"events": len(all_events), "centuries": len(spans),
            "books_mapped": len(BOOK_YEARS), "pruned": pruned}


# ------------------------------------------------- organic growth (research)
#
# Research jobs may PROPOSE chronology items for the chapter they study.
# Proposals are gated by deterministic validation only — year windows per
# volume, dating-label rules per lane, title dedupe against the curated
# roster, a hard per-chapter cap — and merge into the dataset as imp-3
# detail-tier moments. The curated EVENTS stay the honest backbone; the
# roster grows from the nightly research instead of by hand.

_CAT_SET = {"prophets", "rulers", "wars", "visions", "journeys", "temples",
            "records", "turning"}
_DATING_BY_LANE = {
    "nw": {"internal", "approximate"},
    "ow": {"traditional", "approximate", "historical"},
    "rs": {"historical", "approximate"},
}
_CHAPTER_EVENT_CAP = 2
_TITLE_STOP = {"the", "a", "an", "of", "and", "in", "at", "to", "for",
               "his", "her", "their", "is", "are"}


def _book_lane_and_window(book_slug: str):
    """lane + sane year window for a book's proposals; (None, None) = unknown."""
    from .booksdata import BOOKS
    book = next((b for b in BOOKS if b.slug == book_slug), None)
    if not book:
        return None, None
    lane = {"Old Testament": "ow", "New Testament": "ow",
            "Book of Mormon": "nw", "Doctrine and Covenants": "rs",
            "Pearl of Great Price": "rs"}.get(book.volume)
    # PGP carries ancient books alongside Restoration ones
    lane = {"moses": "ow", "abr": "ow", "jsm": "ow"}.get(book_slug, lane)
    if lane is None:
        return None, None
    window = {"ow": (-4100, -390), "nw": (-2300, 430), "rs": (1800, 1995)}[lane]
    if book.volume == "New Testament" or book_slug == "jsm":
        window = (-10, 110)
    return lane, window


def _title_tokens(t: str) -> set[str]:
    import re
    return {w for w in re.findall(r"[a-z]+", t.lower()) if w not in _TITLE_STOP}


def _similar_title(a: str, b: str) -> bool:
    ta, tb = _title_tokens(a), _title_tokens(b)
    if not ta or not tb:
        return False
    return len(ta & tb) / min(len(ta), len(tb)) >= 0.6


def _clean_names(raw, cap: int) -> list[str]:
    out = []
    for x in (raw or [])[:cap]:
        s = str(x).strip()[:100]
        if s:
            out.append(s)
    return out


def ingest_chronology(ctx, chapter_slug: str, proposals: list[dict | None]) -> dict:
    """Validate + store the chronology items research proposed for a chapter.
    Deterministic gate; nothing here trusts a model's dates unchecked."""
    import hashlib

    from .util import now_iso
    db = ctx.db()
    book_slug = chapter_slug.rsplit("-", 1)[0]
    lane, window = _book_lane_and_window(book_slug)
    stats = {"proposed": 0, "stored": 0, "rejected": 0}
    if lane is None:
        return stats
    rows = db.execute("SELECT title FROM timeline_events WHERE chapter_slug=?",
                      (chapter_slug,)).fetchall()
    count = len(rows)
    known_titles = [r["title"] for r in rows] + [e["t"] for e in EVENTS]
    for prop in proposals:
        for item in ((prop or {}).get("chronology") or [])[:3]:
            stats["proposed"] += 1
            title = str(item.get("title", "")).strip()
            basis = str(item.get("basis", "")).strip()
            dating = item.get("dating")
            cats = [c for c in (item.get("cat") or []) if c in _CAT_SET][:2]
            try:
                y0, y1 = int(item["year_start"]), int(item["year_end"])
            except (KeyError, TypeError, ValueError):
                stats["rejected"] += 1
                continue
            ok = (6 <= len(title) <= 90 and len(basis) >= 10 and cats
                  and y0 <= y1 and window[0] <= y0 and y1 <= window[1]
                  and dating in _DATING_BY_LANE[lane]
                  and count < _CHAPTER_EVENT_CAP
                  and not any(_similar_title(title, t) for t in known_titles))
            if not ok:
                stats["rejected"] += 1
                continue
            eid = "r-" + chapter_slug + "-" + \
                hashlib.sha1(title.lower().encode("utf-8")).hexdigest()[:8]
            cur = db.execute(
                "INSERT OR IGNORE INTO timeline_events(event_id,chapter_slug,"
                "title,y0,y1,lane,dating,basis,cat_json,people_json,places_json,"
                "things_json,status,provenance,created_at,updated_at) "
                "VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (eid, chapter_slug, title, y0, y1, lane, dating, basis[:300],
                 json.dumps(cats), json.dumps(_clean_names(item.get("people"), 4)),
                 json.dumps(_clean_names(item.get("places"), 2)),
                 json.dumps(_clean_names(item.get("things"), 2)),
                 "tentative", "pass:research", now_iso(), now_iso()))
            if cur.rowcount:
                count += 1
                stats["stored"] += 1
                known_titles.append(title)
    db.commit()
    if stats["stored"]:
        ctx.log.info("timeline.chronology", chapter=chapter_slug, **stats)
    return stats


def _research_events(ctx) -> list[dict]:
    """Stored research proposals as timeline-event dicts (detail tier)."""
    db = ctx.db()
    try:
        rows = db.execute(
            "SELECT * FROM timeline_events WHERE status IN ('tentative','accepted') "
            "ORDER BY chapter_slug, event_id").fetchall()
    except Exception:  # noqa: BLE001 — a pre-migration db just has no proposals
        return []
    titles = {r["slug"]: r["title"] for r in
              db.execute("SELECT slug, title FROM chapters").fetchall()}
    out = []
    for r in rows:
        e = {"id": r["event_id"], "t": r["title"], "y0": r["y0"], "y1": r["y1"],
             "lane": r["lane"], "imp": 3,
             "cat": json.loads(r["cat_json"] or '["records"]'),
             "dating": r["dating"], "src": "research",
             "note": (r["basis"] or "surfaced by chapter research")}
        chap = titles.get(r["chapter_slug"])
        if chap:
            e["chapters"] = [chap]
        for key, col in (("people", "people_json"), ("places", "places_json"),
                         ("things", "things_json")):
            vals = json.loads(r[col] or "[]")
            if vals:
                e[key] = vals
        out.append(e)
    return out


def merged_events(ctx) -> list[dict]:
    """The full roster: curated backbone + validated research growth."""
    return EVENTS + _research_events(ctx)


# --------------------------------------------- entity pages ⇄ the timeline
#
# Every person/place/thing the chronology touches gets a maintained
# `timeline` marker section on its own page — moments, chapter links, and
# the century anchor — so entity pages, the timeline, and the reading
# surfaces all nest into one graph instead of living in silos.

_TL_SECTION = "timeline"


def _subject_variants(name: str) -> list[str]:
    out = [name]
    if name.endswith("ies"):
        out += [name[:-3] + "i", name[:-3] + "y"]
    elif name.endswith("s"):
        out.append(name[:-1])
    return out


def _resolve_subject(db, name: str) -> str | None:
    for cand in _subject_variants(name):
        r = db.execute("SELECT node_id FROM aliases WHERE alias=?", (cand,)).fetchone()
        if r:
            return r["node_id"]
        r = db.execute("SELECT id FROM nodes WHERE title=?", (cand,)).fetchone()
        if r:
            return r["id"]
    return None


def sync_entity_sections(ctx) -> dict:
    """Maintain the `timeline` marker section on every entity page the
    chronology mentions. Deterministic, diff-gated; runs with every
    scheduled timeline check so new entity pages pick up their moments
    the night after they appear."""
    from .util import read_text
    from .vaultgen import md
    from .vaultgen.generate import record_file
    db = ctx.db()
    stats = {"subjects": 0, "pages": 0, "updated": 0}
    moments: dict[str, dict[str, dict]] = {}
    for e in merged_events(ctx):
        for kind in ("people", "places", "things"):
            for name in e.get(kind, []):
                nid = _resolve_subject(db, name)
                if nid and not nid.startswith("chapter:"):
                    moments.setdefault(nid, {})[e["id"]] = e
    stats["subjects"] = len(moments)
    for nid, by_id in moments.items():
        reg = db.execute(
            "SELECT path, kind, managed_by FROM file_registry WHERE node_id=? "
            "AND kind IN ('person','place','event','topic')", (nid,)).fetchone()
        if not reg:
            continue
        abspath = ctx.vault / reg["path"]
        if not abspath.exists():
            continue
        stats["pages"] += 1
        evs = sorted(by_id.values(), key=lambda e: (e["y0"], e["id"]))[:12]
        lines = []
        for e in evs:
            year = _year_str(e["y0"]) if e["y0"] == e["y1"] else \
                f"{_year_str(e['y0'])}–{_year_str(e['y1'])}"
            line = f"- **{year}** — {e['t']}"
            chaps = " · ".join(f"[[{c}]]" for c in e.get("chapters", [])[:3])
            if chaps:
                line += f" · {chaps}"
            line += (f" · [[{_span_title(_century_span(e['y0']))}]]"
                     f" *({DATING_MARK[e['dating']]})*")
            lines.append(line)
        lines += ["", "*Open the 🕰 Timeline from the navigator and Focus this "
                      "name to walk the whole thread.*"]
        new_inner = "\n".join(lines)
        content = read_text(abspath)
        fm, body = md.parse_note(content)
        if md.get_section(body, _TL_SECTION) is not None:
            if (md.get_section(body, _TL_SECTION) or "").strip() == new_inner.strip():
                continue
            body = md.set_section(body, _TL_SECTION, new_inner)
        else:
            body = (body.rstrip() + "\n\n## ⏳ In the Timeline\n"
                    + md.marker_block(_TL_SECTION, new_inner) + "\n")
        record_file(ctx, reg["path"], reg["kind"], reg["managed_by"], nid,
                    md.build_note(fm, body))
        stats["updated"] += 1
    return stats


def dataset_hash(ctx=None) -> str:
    """content fingerprint of the chronology — changes iff the dataset does
    (curated roster, book map, threads, AND stored research proposals)"""
    import hashlib
    payload = {"e": EVENTS, "b": BOOK_YEARS, "t": THREADS}
    if ctx is not None:
        payload["r"] = [dict(r) for r in _research_events(ctx)]
    blob = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def maybe_build_timeline(ctx, force: bool = False) -> dict:
    """Regenerate the timeline ONLY when the chronology changed (or its
    output is missing) — called from the scheduled runs, so the timeline
    stays current organically without nightly git churn. Entity-page
    timeline sections re-sync every call (diff-gated writes) because they
    also depend on which entity pages exist by now."""
    h = dataset_hash(ctx)
    data_file = ctx.vault / OUTPUT_SUB / "_data.md"
    if not force and ctx.meta_get("timeline:hash") == h and data_file.exists():
        stats: dict = {"skipped": "unchanged"}
    else:
        stats = build_timeline(ctx)
        ctx.meta_set("timeline:hash", h)
        stats["rebuilt"] = True
    try:
        stats["sections"] = sync_entity_sections(ctx)
    except Exception as e:  # noqa: BLE001 — sections must never sink a run
        ctx.log.warn("timeline.sections_failed", error=str(e)[:200])
    return stats
