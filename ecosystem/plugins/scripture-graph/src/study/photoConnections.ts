/** Chapter links describe artwork, not archaeological identifications. Named
 * scenes are linked deliberately; general settings use the chapter's words. */
export interface PhotoConnection { chapters: string[]; reason: string; }
const refs = (list: string, reason: string): PhotoConnection => ({ chapters: list.split(' '), reason });
export const PHOTO_CONNECTIONS: Record<string, PhotoConnection> = {
  'emmaus-road': refs('luke-24', 'The walk to Emmaus and recognition of the risen Lord (verses 13–35).'),
  'bethany-courtyard': refs('luke-10 john-11 john-12 mark-14 matt-26', 'The home and hospitality of Martha, Mary, and Lazarus, or the anointing at Bethany.'),
  'cana-feast': refs('john-2', 'The wedding at Cana and the six stone waterpots (verses 1–11).'),
  'nazareth-workshop': refs('mark-6 matt-13 luke-2', 'Jesus’ upbringing and identification as a carpenter or carpenter’s son; an imagined setting, not a recorded workshop scene.'),
  'bethesda-pool': refs('john-5', 'The healing at the pool of Bethesda (verses 1–15).'),
  'siloam-steps': refs('john-9', 'The man born blind washes in the pool of Siloam (verses 1–11).'),
  'galilee-moonrise': refs('john-21 mark-6 matt-14 john-6', 'Night fishing or the evening crossing of the Sea of Galilee; the moonlight is artistic.'),
  'mustard-garden': refs('matt-13 mark-4 luke-13 matt-17 luke-17', 'The mustard seed in teachings about the kingdom or faith.'),
  'lilies-field': refs('matt-6 luke-12 3ne-13', 'Consider the lilies: trust in the Father’s care. A visual teaching aid, not a claim about the location of 3 Nephi.'),
  'sower-furrows': refs('matt-13 mark-4 luke-8', 'The parable of the sower and the different soils.'),
  'jericho-palms': refs('josh-6 deut-34 luke-19 mark-10', 'Jericho, the city of palm trees, and journeys through it; an imagined landscape.'),
  'sinai-starlight': refs('ex-19 ex-24 ex-34', 'Moses on Mount Sinai. The nighttime appearance is artistic, not a timestamp in the text.'),
  'horeb-cave': refs('1kgs-19', 'Elijah at Horeb, the cave, and the still small voice (verses 8–13).'),
  'tabernacle-dawn': refs('ex-40 num-9 lev-1 lev-8', 'The tabernacle, its offerings, priestly service, or the cloud resting on it.'),
  'ruth-harvest': refs('ruth-1 ruth-2 ruth-3', 'The barley harvest, gleaning in Boaz’s field, and the threshing floor.'),
  'esther-garden': refs('esth-1 esth-7', 'The palace garden mentioned in the royal feast and Esther’s banquet.'),
  'daniel-window': refs('dan-6', 'Daniel prays with his windows open toward Jerusalem (verse 10).'),
  'psalm-waterfall': refs('ps-42', '“Deep calleth unto deep” and the waterspouts (verse 7), visualized as a waterfall.'),
  'salt-sea-dawn': refs('gen-14 num-34 josh-15 ezek-47', 'The Salt Sea as a boundary or the sea whose waters are healed; an evocative landscape.'),
  'hermon-snow': refs('ps-133 deut-3 song-4 ps-89', 'Hermon is named in these passages. Snow is a landscape illustration; Psalm 133 speaks of dew.'),
  'bountiful-coast': refs('1ne-17 1ne-18', 'The Old World Bountiful coast where Nephi builds and launches the ship. Its precise location is not established by this artwork.'),
  'cumorah-morning': refs('morm-6 ether-15', 'The hill Cumorah, also called Ramah in Ether 15:11. This imagined scene does not identify a modern site.'),
  'nahom-canyon': refs('1ne-16 1ne-17', 'Nahom and the eastward wilderness journey. The canyon is imaginative, not a verified view of the route.'),
  'zarahemla-river': refs('alma-2 alma-6 alma-16 alma-43 alma-44', 'Zarahemla and the river Sidon in journeys, baptisms, and battles. The landscape does not establish a modern river identification.'),
  'liberty-window': refs('dc-121 dc-122 dc-123', 'The March 1839 Liberty Jail letter, excerpted in these sections; an imagined view from confinement.'),
  'nauvoo-riverside': refs('dc-124 dc-127 dc-128 dc-135', 'Revelation, letters, and events associated with Nauvoo; a contextual riverside setting.'),
  'pioneer-meadow': refs('dc-136', 'Instructions for the pioneer journey at Winter Quarters. The meadow evokes the later journey, not the place where the section was received.'),
  'autumn-sanctuary': refs('eccl-3 ps-104', 'Seasons and the works of creation. A contemplative reading atmosphere, not an ancient sanctuary reconstruction.'),
  creation: refs('gen-1 gen-5 moses-2 abr-4', 'Creation, or a passage recalling creation. Genesis 5:1–2 opens its genealogy by recalling the creation of humanity; the landscape does not depict the named generations.'),
  'grove': refs('jsh-1 enos-1 ps-1', 'Trees and prayer: a general contemplative setting, distinct from the event artwork.'),
  'shepherd-pasture': refs('ps-23 john-10 ezek-34 luke-15', 'Shepherds, sheep, and the care of the flock.'),
  'mountain-refuge': refs('1sam-22 1sam-24 ps-57', 'David’s refuge in caves; the precise cave is not reconstructed.'),
  'desert-oasis': refs('ex-15 num-33', 'Elim, its twelve wells of water, and seventy palm trees.'),
  'upper-room': refs('mark-14 luke-22 acts-1 acts-20', 'An upper room used for gathering, the Passover, or teaching.'),
  'cedar-forest': refs('1kgs-5 ps-29 ps-92 ezek-31', 'Cedars of Lebanon as building material or poetic imagery.'),
  'pilgrim-road': refs('ps-84 ps-122 luke-2', 'Travel and pilgrimage to Jerusalem.'),
  'vineyard': refs('isa-5 matt-20 matt-21 mark-12 luke-20', 'Vineyards and their workers in prophecy and parables.'),
  'fishing-village': refs('matt-4 mark-1 luke-5', 'The lakeside villages and call of the fishermen.'),
  'wilderness-path': refs('ex-13 deut-8 isa-40 luke-10', 'Wilderness travel or the road from Jerusalem to Jericho.'),
  'ancient-synagogue': refs('luke-4 mark-3 acts-13', 'Reading, healing, or preaching in a synagogue.'),
  'village-well': refs('gen-24 gen-29 ex-2 john-4', 'Meetings at a well and drawing water.'),
  'potters-workshop': refs('jer-18 isa-64 rom-9', 'The potter and clay as prophetic or teaching imagery.'),
};

export interface SettingRule { ids: string[]; words: RegExp; reason: string; }
export const SETTING_RULES: SettingRule[] = [
  { ids: ['temple'], words: /\b(temple|altar|priests?|offerings?|sanctuary|tabernacle)\b/gi, reason: 'Temple, worship, and offerings' },
  { ids: ['warcamp'], words: /\b(armies|army|battle|war|wars|swords?|soldiers?|captains?|siege)\b/gi, reason: 'Conflict and armies' },
  { ids: ['prison'], words: /\b(prison|prisoners?|dungeon|chains|fetters|captivity|captive)\b/gi, reason: 'Captivity and deliverance' },
  { ids: ['desert', 'wilderness-path'], words: /\b(wilderness|desert|journey|journeyed|tents?|encamped)\b/gi, reason: 'Wilderness and journeys' },
  { ids: ['waters', 'riverbank'], words: /\b(waters?|rivers?|fountains?|streams?|baptized|baptism)\b/gi, reason: 'Water and baptism imagery' },
  { ids: ['storm'], words: /\b(storm|tempest|whirlwind|thunder|lightning|waves|billows)\b/gi, reason: 'Storm and troubled waters' },
  { ids: ['mount', 'mountain-refuge'], words: /\b(mountain|mountains|hills?|mount|rocks?|refuge)\b/gi, reason: 'Mountains, rock, and refuge' },
  { ids: ['fields', 'sower-furrows'], words: /\b(harvest|wheat|barley|reap|sow|sower|fields?|tares)\b/gi, reason: 'Fields, sowing, and harvest imagery' },
  { ids: ['garden'], words: /\b(garden|gardens|trees?|branches|fruit|eden)\b/gi, reason: 'Gardens, trees, and fruit imagery' },
  { ids: ['olive'], words: /\b(olive|olives|oliveyard|oliveyards)\b/gi, reason: 'Olive trees and their imagery' },
  { ids: ['vineyard'], words: /\b(vineyard|vineyards|grapes|winepress|vines?)\b/gi, reason: 'Vines and vineyards' },
  { ids: ['shepherd-pasture'], words: /\b(shepherds?|pastures?|sheep|flocks?|lambs?)\b/gi, reason: 'Shepherd and flock imagery' },
  { ids: ['starlight'], words: /\b(stars?|moon|heavens?|firmament)\b/gi, reason: 'The heavens and celestial imagery' },
  { ids: ['sunrise'], words: /\b(morning|dawn|light|arise|shine)\b/gi, reason: 'Morning and light imagery' },
  { ids: ['grove', 'autumn-sanctuary'], words: /\b(pray|prayer|prayers|meditate|meditation|ponder)\b/gi, reason: 'A contemplative reading atmosphere for prayer and reflection' },
];

export function connectionReason(id: string, slug: string): string {
  const explicit = PHOTO_CONNECTIONS[id];
  if (explicit?.chapters.includes(slug)) return explicit.reason;
  return SETTING_RULES.find(rule => rule.ids.includes(id))?.reason
    ? `${SETTING_RULES.find(rule => rule.ids.includes(id))!.reason}. A thematic reading setting, not necessarily a depiction of the event.`
    : 'An artistic interpretation connected to this chapter’s account.';
}
