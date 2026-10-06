import raw from './atlas.json';
import geography from './basemap.json';
import reconstruction from './reconstruction.json';
import reliefData from './relief.json';
import destructionData from './destruction.json';
import { openResearchGallery, researchPhotoFor } from './research-gallery';
import { attachMapInteractions, type MapInteractionHandle } from './map-interactions';
import evidenceGuide from './evidence-guide.json';
import { renderSettlementTravel, type CityTravelSettings } from './settlement-travel';
import { distanceKm, projection, type XY } from './math';

type World = 'old' | 'new' | 'bom';
interface Point { id: string; name: string; world: string; xy: number[] | null; ref: string; note: string; status: string; path: string }
interface ModelPoint { id: string; lon: number; lat: number; modernName?: string; confidence?: string; uncertaintyKm?: number; rationale?: string; refs?: string[]; sourceRoles?: {url:string;role:string}[] }
interface Model { id: string; name: string; bounds: number[]; summary: string; points: ModelPoint[]; rivers?: {name: string; coordinates: number[][][]}[] }
interface PhysicalEvidence { id: string; name: string; lon: number; lat: number; coordinateMeaning: string; siteStatus: string; dateRange: string; datePrecision: string; connectionStatus: string; textEvent: string; summary: string; sourceUrls: string[]; path: string }
const physicalEvidence = (destructionData as unknown as {markers: PhysicalEvidence[]}).markers;
const data = raw as unknown as { points: Point[]; routes: { a: string; b: string; days: number; ref: string; note: string }[]; sources: Record<string, string[]> };
const models = (reconstruction as unknown as {models: Model[]}).models;
const relief = reliefData as unknown as Record<string, {bounds: number[]; url: string}>;
const NS = 'http://www.w3.org/2000/svg';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, parent: Element, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = cls; parent.append(node); return node;
}
function svgEl(tag: string, parent: Element, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text) node.textContent = text;
  parent.append(node); return node;
}
function button(parent: Element, label: string, action: () => void, cls = '') {
  const b = el('button', parent, label, cls); b.type = 'button'; b.onclick = action; return b;
}
function external(parent: Element, label: string, url: string) {
  const a = el('a', parent, label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
}
function choice(parent: Element, title: string, rows: [string, string][], value: string, onChange: (value: string) => void) {
  const select = el('select', parent, '', 'sg-atlas-select'); select.setAttribute('aria-label', title);
  for (const [id, name] of rows) { const option = el('option', select, name); option.value = id; }
  select.value = value; select.onchange = () => onChange(select.value); return select;
}

/** Offline, pure DOM renderer shared by Obsidian and the browser review harness. */
export function renderAtlas(container: HTMLElement, navigateNote: (path: string) => void): () => void {
  let world: World = 'bom', region = 'holy', modelId = models[0]?.id ?? '';
  let selected = '', query = '', directoryOpen = false, labels = true, uncertainty = true, evidenceVisible = true;
  let zoom = 1, pan: XY = [0, 0], disposed = false, resize: ResizeObserver | undefined;
  let interactions: MapInteractionHandle | undefined, closeResearch: (()=>void) | undefined;
  let mapActive = false, refreshInteractionMode = () => {}, focusEvidence = '';
  const cityTravel: CityTravelSettings = {departure:1,arrival:1,factor:1.5,rate:25,includeLocation:false};
  const root = el('section', container, '', 'sg-atlas');
  const home = document.createComment('atlas position'); container.insertBefore(home, root);
  const fullscreen = document.createElement('dialog'); fullscreen.className = 'sg-atlas-fullscreen';
  document.body.append(fullscreen);
  let returnFocus: HTMLElement | null = null;
  function leaveFullscreen() {
    if (fullscreen.open) fullscreen.close();
    if (home.parentNode) home.parentNode.insertBefore(root, home.nextSibling);
    expand.textContent = '⛶ Full screen'; returnFocus?.focus();
    refreshInteractionMode();
  }
  fullscreen.addEventListener('cancel', e => { e.preventDefault(); leaveFullscreen(); });
  const expand = button(root, '⛶ Full screen', () => {
    if (fullscreen.open) { leaveFullscreen(); return; }
    returnFocus = document.activeElement as HTMLElement;
    fullscreen.append(root); fullscreen.showModal(); expand.textContent = '↙ Exit full screen'; expand.focus();
    refreshInteractionMode();
  }, 'sg-atlas-expand');
  fullscreen.setAttribute('aria-label', 'Full-screen scripture atlas');
  const fullscreenTools=el('nav',root,'','sg-atlas-fullscreen-tools');fullscreenTools.setAttribute('aria-label','Full-screen atlas tools');
  const fullscreenOptions=button(fullscreenTools,'Places & maps',()=>{
    const open=root.classList.toggle('sg-atlas-options-open');fullscreenOptions.setAttribute('aria-expanded',String(open));
    if(open)root.querySelector<HTMLInputElement>('.sg-atlas-search')?.focus({preventScroll:true});
  },'sg-atlas-browse');fullscreenOptions.setAttribute('aria-expanded','false');
  button(fullscreenTools,'Photos',()=>showResearch(selected),'sg-atlas-browse');
  function openNote(path: string) { if(fullscreen.open) leaveFullscreen(); navigateNote(path); }
  function evidenceCard(parent: Element, id: string) {
    const item = (evidenceGuide as Record<string,{title:string;support:string;challenge:string;chapter:string}>)[id];
    if(!item) return;
    const card = el('article', parent, '', 'sg-atlas-evidence-card');
    el('h4', card, item.title);
    el('strong', card, 'What supports the proposal'); el('p', card, item.support);
    el('strong', card, 'What still needs to fit'); el('p', card, item.challenge);
    button(card, 'Read the evidence and citations ↗', () => openNote(`AI Library/91 Maps/${item.chapter}.md`), 'sg-atlas-text-button');
  }
  const head = el('header', root, '', 'sg-atlas-header');
  const brand = el('div', head, '', 'sg-atlas-brand');
  el('span', brand, 'SCRIPTURE GRAPH', 'sg-atlas-eyebrow'); el('h2', brand, 'Atlas');
  const tabs = el('nav', head, '', 'sg-atlas-tabs'); tabs.setAttribute('aria-label', 'Map collection');
  const tabButtons = (['old', 'new', 'bom'] as World[]).map(id => ({ id, button: button(tabs,
    { old: 'Old World', new: 'New World', bom: 'Book of Mormon' }[id], () => {
      world = id; selected = ''; query = ''; directoryOpen = false; reset(); render();
    }) }));
  const contents = el('div', root, '', 'sg-atlas-content');
  function showResearch(place = '') {
    closeResearch?.(); interactions?.cancel();
    closeResearch = openResearchGallery(place, {openNote,closed:()=>{closeResearch=undefined;},viewMap:id=>{
      if(physicalEvidence.some(p=>p.id===id)){
        world='new';region='america';evidenceVisible=true;selected=id;focusEvidence=id;query='';directoryOpen=false;reset();zoom=5;render();
      } else {const p=data.points.find(p=>p.id===id);if(p){world=p.world as World;region=world==='old'?'wide':'america';if(world==='bom'&&!models.find(m=>m.id===modelId)?.points.some(a=>a.id===id)){const supported=models.find(m=>m.points.some(a=>a.id===id));if(supported)modelId=supported.id;}selected=p.id;query='';directoryOpen=false;reset();render();}}
    }});
  }
  function reset() { zoom = 1; pan = [0, 0]; }
  function sourceLinks(parent: Element, refs: string) {
    if (data.sources[refs]) { const [name, url] = data.sources[refs]!; external(parent, name!, url!); return; }
    for (const ref of refs.split('; ').filter(Boolean)) {
      if (/^https?:\/\//.test(ref)) external(parent, 'Read source ↗', ref);
      else {
        const match = ref.match(/^(1 Nephi|2 Nephi|3 Nephi|4 Nephi|Jacob|Enos|Jarom|Omni|Words of Mormon|Mosiah|Alma|Helaman|Mormon|Ether|Moroni)\s+(\d+)(?::(\d+))?/);
        const slugs: Record<string,string> = {'1 Nephi':'1-ne','2 Nephi':'2-ne','3 Nephi':'3-ne','4 Nephi':'4-ne','Words of Mormon':'w-of-m'};
        if (match) external(parent, ref, `https://www.churchofjesuschrist.org/study/scriptures/bofm/${slugs[match[1]!] ?? match[1]!.toLowerCase()}/${match[2]}?lang=eng${match[3] ? `&id=p${match[3]}#p${match[3]}` : ''}`);
        else button(parent, ref, () => openNote('AI Library/91 Maps/Book of Mormon geographic reconstruction.md'), 'sg-atlas-text-button');
      }
    }
  }
  function render() {
    if (disposed) return;
    root.classList.remove('sg-atlas-options-open');fullscreenOptions.setAttribute('aria-expanded','false');
    interactions?.dispose(); resize?.disconnect(); contents.replaceChildren();
    for (const tab of tabButtons) tab.button.setAttribute('aria-pressed', String(tab.id === world));
    const model = models.find(m => m.id === modelId) ?? models[0];
    const shown = data.points.filter(p => p.world === world);
    const bounds = world === 'bom' ? model?.bounds ?? [-99, 12, -87, 21]
      : world === 'old' ? region === 'wide' ? [8, 19, 53, 44] : region === 'arabia' ? [30, 10, 60, 35] : [33.7, 30.6, 36.7, 33.6]
      : region === 'restoration' ? [-115, 35, -73, 46] : [-130, -57, -33, 60];
    const proj = projection(bounds);
    let baseWidth=1000,baseHeight=620;
    function coordinate(p: Point): XY | null {
      if (p.world === 'bom') { const m = model?.points.find(x => x.id === p.id); return m ? [m.lon, m.lat] : null; }
      return p.xy ? [p.xy[0]!, p.xy[1]!] : null;
    }
    const top = el('div', contents, '', 'sg-atlas-topbar');
    const searchWrap = el('div', top, '', 'sg-atlas-search-wrap');
    el('span', searchWrap, '⌕', 'sg-atlas-search-icon');
    const search = el('input', searchWrap, '', 'sg-atlas-search'); search.type = 'search'; search.placeholder = 'Find any place…';
    search.setAttribute('aria-label', 'Find a place across all maps'); search.value = query;
    search.setAttribute('aria-controls', 'sg-atlas-search-results');
    const resultPanel = el('div', searchWrap, '', 'sg-atlas-search-results'); resultPanel.id = 'sg-atlas-search-results';
    if (world === 'bom') choice(top, 'Geography perspective', models.map(m => [m.id, m.name]), modelId, id => { modelId = id; reset(); render(); });
    else if (world === 'old') choice(top, 'Map region', [['holy', 'Holy Land'], ['wide', 'Mediterranean & Near East'], ['arabia', 'Arabia']], region, id => { region = id; reset(); render(); });
    else choice(top, 'Map region', [['america', 'The Americas'], ['restoration', 'Restoration places']], region === 'restoration' ? region : 'america', id => { region = id; reset(); render(); });
    button(top, 'Places', () => { directoryOpen = !directoryOpen; renderDirectory(); }, 'sg-atlas-browse');
    button(top, 'Research & photos', () => showResearch(selected), 'sg-atlas-browse');
    const interactionBar=el('div',contents,'','sg-atlas-interaction-bar');
    const interactionHint=el('span',interactionBar,'','sg-atlas-small');
    const activate=button(interactionBar,'Move map',()=>{mapActive=!mapActive;refreshInteractionMode();},'sg-atlas-browse');
    refreshInteractionMode=()=>{
      const active=mapActive||fullscreen.open;
      interactionHint.textContent=active?'Drag to explore · pinch to zoom · tap a place':'Tap a place or its name · swipe to scroll the page';
      activate.hidden=fullscreen.open;activate.textContent=mapActive?'Done moving':'Move map';activate.setAttribute('aria-pressed',String(mapActive));interactions?.refreshMode();
    };
    const stage = el('div', contents, '', 'sg-atlas-stage');
    const viewport = el('div', stage, '', 'sg-atlas-viewport');
    const svg = svgEl('svg', viewport, { viewBox: '0 0 1000 620', role: 'group', 'aria-label': `${world === 'bom' ? model?.name ?? 'Book of Mormon' : world === 'old' ? 'Old World' : 'New World'} interactive map`, tabindex: 0 }) as SVGSVGElement;
    const map = svgEl('g', svg), halos = svgEl('g', svg, {'pointer-events':'none'}), marks = svgEl('g', svg);
    svgEl('rect', map, { x: -20000, y: -20000, width: 40000, height: 40000, fill: '#b6d0d3' });
    const terrain = relief[world === 'old' && region === 'holy' ? 'holy' : world === 'bom' ? modelId : world] ?? relief[world];
    const coastPaths: string[] = [];
    for (const kind of ['land', 'lakes'] as const) {
      const paths: string[] = [];
      for (const ring of geography[kind]) {
        const xs = ring.map(p => p[0]!), ys = ring.map(p => p[1]!);
        if (Math.max(...xs) < bounds[0]! - 10 || Math.min(...xs) > bounds[2]! + 10 || Math.max(...ys) < bounds[1]! - 10 || Math.min(...ys) > bounds[3]! + 10) continue;
        paths.push(ring.map((p, i) => `${i ? 'L' : 'M'}${proj(p).map(n => n.toFixed(2)).join(',')}`).join('') + 'Z');
      }
      svgEl('path', map, { d: paths.join(''), fill: kind === 'land' ? '#e0dfc4' : '#b6d0d3', stroke: kind === 'land' ? '#728e87' : '#9dbdbf', 'stroke-width': .65, 'fill-rule': 'evenodd' });
      coastPaths.push(paths.join(''));
    }
    const broadTerrain = relief[world === 'old' ? 'old' : 'new'];
    for (const layer of [broadTerrain, terrain].filter((item, index, all) => item?.url && (index === 0 || item !== all[0]))) {
      if (!layer) continue;
      const nw = proj([layer.bounds[0]!, layer.bounds[3]!]), se = proj([layer.bounds[2]!, layer.bounds[1]!]);
      const width=se[0]-nw[0],height=se[1]-nw[1];
      const image=svgEl('image', map, { href: layer.url, x: nw[0], y: nw[1], width, height, preserveAspectRatio: 'none' });
      if(layer!==broadTerrain){
        const id='atlas-feather-'+Math.random().toString(36).slice(2),defs=svgEl('defs',svg),filter=svgEl('filter',defs,{id:id+'-blur',x:'-10%',y:'-10%',width:'120%',height:'120%'});
        svgEl('feGaussianBlur',filter,{stdDeviation:Math.min(width,height)*.008});
        const mask=svgEl('mask',defs,{id,maskUnits:'userSpaceOnUse',x:nw[0],y:nw[1],width,height});
        svgEl('rect',mask,{x:nw[0]+width*.008,y:nw[1]+height*.008,width:width*.984,height:height*.984,fill:'white',filter:`url(#${id}-blur)`});
        image.setAttribute('mask',`url(#${id})`);
      }
    }
    svgEl('path', map, {d: coastPaths.join(''), fill: 'none', stroke: '#688e8a', 'stroke-width': .45, 'stroke-opacity': .5});
    if (world === 'bom') for (const river of model?.rivers ?? []) {
      const path = river.coordinates.map(line => line.map((p, i) => `${i ? 'L' : 'M'}${proj(p).join(',')}`).join('')).join('');
      const group=svgEl('g',map,{'data-place':'sidon',role:'button',tabindex:0,'aria-label':`${river.name}, open Sidon details`,class:'sg-atlas-pin'});
      const line = svgEl('path', group, {d: path, fill: 'none', stroke: '#447e93', 'stroke-width': 1.8, 'stroke-linecap': 'round'});
      svgEl('path',group,{d:path,fill:'none',stroke:'transparent','stroke-width':14,'vector-effect':'non-scaling-stroke'});
      svgEl('title', line, {}, river.name);
      const openRiver=()=>{const p=data.points.find(p=>p.id==='sidon');if(p)pick(p);};
      group.addEventListener('click',openRiver);group.addEventListener('keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();openRiver();drawer.querySelector('button')?.focus({preventScroll:true});}});
    }
    const caption = el('div', stage, '', 'sg-atlas-map-caption');
    el('span', caption, world === 'bom' ? 'GEOGRAPHIC RECONSTRUCTION' : 'PLACES IN SCRIPTURE', 'sg-atlas-eyebrow');
    el('h3', caption, world === 'bom' ? model?.name ?? 'Book of Mormon' : world === 'old' ? region === 'holy' ? 'The Holy Land' : region === 'arabia' ? 'Across Arabia' : 'The ancient world' : region === 'restoration' ? 'Places of the Restoration' : 'The Americas');
    el('p', caption, world === 'bom' ? 'Proposed anchors on real terrain · tap a place to explore' : 'Explore a place. Follow its story.');
    const compass = el('div', stage, 'N', 'sg-atlas-compass'); compass.setAttribute('aria-label', 'North is up');
    el('span', compass, '↑');
    const controls = el('div', stage, '', 'sg-atlas-map-controls');
    button(controls, '⛶', () => expand.click(), 'sg-atlas-zoom').setAttribute('aria-label', 'Toggle full-screen map');
    button(controls, '+', () => zoomTo(zoom * 1.6), 'sg-atlas-zoom').setAttribute('aria-label', 'Zoom in');
    button(controls, '−', () => zoomTo(zoom / 1.6), 'sg-atlas-zoom').setAttribute('aria-label', 'Zoom out');
    button(controls, '⌂', () => { reset(); setView(); }, 'sg-atlas-zoom').setAttribute('aria-label', 'Reset map view');
    const scale = el('div', stage, '', 'sg-atlas-scale');
    const legend = el('div', stage, '', 'sg-atlas-legend');
    el('span', legend, world === 'bom' ? '◉ Proposed place' : '● Place');
    if (world === 'bom') el('span', legend, '◌ Illustrative search area');
    const drawer = el('aside', stage, '', 'sg-atlas-drawer'); drawer.setAttribute('aria-label', 'Place details'); drawer.setAttribute('aria-live', 'polite');
    const directory = el('aside', stage, '', 'sg-atlas-directory'); directory.setAttribute('aria-label', 'Place directory');
    const bottom = el('div', contents, '', 'sg-atlas-bottom');
    const layerMenu = el('details', bottom, '', 'sg-atlas-layer-menu'); el('summary',layerMenu,'Map layers');
    const layerControls = el('div', layerMenu, '', 'sg-atlas-layers');
    button(bottom, 'Evidence & photos', () => showResearch(selected), 'sg-atlas-primary');
    button(bottom, 'Find a place', () => {directoryOpen = true; renderDirectory(); directory.scrollIntoView({block:'nearest'});}, 'sg-atlas-browse');
    const journeyPanel = el('details', contents, '', 'sg-atlas-travel sg-atlas-journey-panel'); journeyPanel.hidden = world !== 'bom';
    const journeySummary = el('summary',journeyPanel,'City size & travel distances');
    const departure = model?.points.find(p=>p.id==='nephi-city'),arrival = model?.points.find(p=>p.id==='zarahemla');
    if(world==='bom'&&model&&departure&&arrival) renderSettlementTravel(journeyPanel,model,departure,arrival,cityTravel,openNote);
    function showJourney() { journeyPanel.open=true; journeySummary.focus(); journeyPanel.scrollIntoView({block:'start'}); }
    if(world==='bom') button(bottom,'Travel distances',showJourney,'sg-atlas-browse');
    function toggle(label: string, checked: boolean, change: (value: boolean) => void) { const l = el('label', layerControls); const input = el('input', l); input.type = 'checkbox'; input.checked = checked; l.append(label); input.onchange = () => change(input.checked); }
    toggle('Place names', labels, value => { labels = value; drawMarkers(); });
    if (world === 'bom') toggle('Search areas', uncertainty, value => { uncertainty = value; drawMarkers(); });
    if (world === 'bom' || world === 'new') toggle('Physical evidence', evidenceVisible, value => { evidenceVisible = value; drawMarkers(); });
    const notes = el('details', contents, '', 'sg-atlas-method');
    el('summary', notes, world === 'bom' ? 'How this reconstruction was made' : 'About these locations');
    el('p', notes, world === 'bom' ? model?.summary ?? 'Textual geography is explored on a modern landscape.' : 'Modern coordinates are approximate anchors. A regional label does not define an ancient border. Disputed or unknown locations remain available in the place directory.');
    if (world === 'bom') {
      el('p', notes, 'Working premise: the Book of Mormon records real events. The proposed coordinates are a geographic hypothesis, not an archaeological identification. Search-area circles visualize uncertainty; they are not statistical confidence intervals.');
      const geologyNotes = el('details', notes, '', 'sg-atlas-travel');
      el('summary', geologyNotes, 'Destruction events & physical evidence');
      el('p', geologyNotes, 'Compare real geological sites and published dates. The New World map shows all four locations with Physical evidence enabled by default.');
      for (const item of physicalEvidence) {
        const row = el('p', geologyNotes); button(row, item.name + ' ↗', () => openNote(item.path), 'sg-atlas-text-button'); row.append(` · ${item.dateRange}`);
      }
      const travel = el('details', notes, '', 'sg-atlas-travel'); el('summary', travel, 'Scriptural travel stages — endpoints remain distinct');
      el('p', travel, 'These are separate narrative stages, not center-to-center city measurements. Mosiah 24 ends in the land of Zarahemla; its boundary is unlocated. Terrain, group size and stops change travel. Use City size & travel distances above for explicit endpoint scenarios.');
      const readout = el('p', travel); const range = el('input', travel); range.type = 'range'; range.min = '10'; range.max = '50'; range.step = '5'; range.value = '25'; range.setAttribute('aria-label', 'Assumed kilometers per travel day');
      const itineraries = el('div', travel);
      const update = () => { const rate = Number(range.value); readout.textContent = `Assumed travel rate: ${rate} km/day`; itineraries.replaceChildren();
        for (const route of data.routes) { const a = data.points.find(p => p.id === route.a), b = data.points.find(p => p.id === route.b); if (!a || !b) continue; const origin=route.a==='melek'?'Land of Melek':a.name; const destination=route.b==='zarahemla'?'Land of Zarahemla (entry boundary unlocated)':b.name; const row = el('p', itineraries, `${origin} → ${destination}: ${route.days} days × ${rate} = ${route.days * rate} assumed route km. ${route.note} `); sourceLinks(row, route.ref); }
      }; range.oninput = update; update();
    }
    const credits = el('div', contents, '', 'sg-atlas-credit');
    credits.append('Offline atlas · Mapzen terrain tiles / contributors · Natural Earth coastlines · ');
    external(credits, 'Map credits', data.sources.earth?.[1] ?? 'https://www.naturalearthdata.com/');
    credits.append(' · '); button(credits, 'Terrain sources', () => openNote('AI Library/91 Maps/Map sources and terrain.md'), 'sg-atlas-text-button');

    function view() { return { left: 500 - baseWidth / 2 / zoom + pan[0], top: 310 - baseHeight / 2 / zoom + pan[1], width: baseWidth / zoom, height: baseHeight / zoom }; }
    function setView() {
      const nw=proj([bounds[0]!,bounds[3]!]),se=proj([bounds[2]!,bounds[1]!]);
      const ratio=(viewport.clientWidth||1000)/(viewport.clientHeight||620);
      baseWidth=(se[0]-nw[0])*1.1;baseHeight=(se[1]-nw[1])*1.1;
      if(baseWidth/baseHeight<ratio)baseWidth=baseHeight*ratio;else baseHeight=baseWidth/ratio;
      const v = view(); svg.setAttribute('viewBox', `${v.left} ${v.top} ${v.width} ${v.height}`); drawMarkers();
      const pixelsPerUnit = Math.min(viewport.clientWidth / v.width, viewport.clientHeight / v.height) || 1;
      const a = proj([(bounds[0]! + bounds[2]!) / 2, (bounds[1]! + bounds[3]!) / 2]);
      const b = proj([(bounds[0]! + bounds[2]!) / 2 + 1, (bounds[1]! + bounds[3]!) / 2]);
      const kmDegree = distanceKm([(bounds[0]! + bounds[2]!) / 2, (bounds[1]! + bounds[3]!) / 2], [(bounds[0]! + bounds[2]!) / 2 + 1, (bounds[1]! + bounds[3]!) / 2]);
      const kmPixel = kmDegree / (Math.abs(b[0] - a[0]) * pixelsPerUnit);
      const target = kmPixel * 100; const magnitude = 10 ** Math.floor(Math.log10(target)); const step = [1, 2, 5].map(n => n * magnitude).filter(n => n <= target).pop() ?? magnitude;
      scale.textContent = `${step.toLocaleString()} km`; scale.style.width = `${step / kmPixel}px`;
    }
    function zoomTo(next: number, anchor: XY = [500, 310]) {
      const previous = zoom; zoom = Math.max(1, Math.min(24, next));
      pan = [pan[0] + (anchor[0] - 500) * (1 / previous - 1 / zoom), pan[1] + (anchor[1] - 310) * (1 / previous - 1 / zoom)]; setView();
    }
    function pick(p: Point, focus = false) {
      if (p.world !== world && ['old', 'new', 'bom'].includes(p.world)) { world = p.world as World; selected = p.id; query = ''; directoryOpen = false; region = world === 'old' ? 'wide' : 'america'; reset(); render(); return; }
      selected = p.id; directoryOpen = false; query = ''; search.value = ''; resultPanel.hidden = true; directory.hidden = true;
      const xy = coordinate(p);
      if (xy) {
        if (world === 'old' && (xy[0] < bounds[0]! || xy[0] > bounds[2]! || xy[1] < bounds[1]! || xy[1] > bounds[3]!)) { region = 'wide'; reset(); render(); return; }
        if (world === 'new' && region === 'restoration' && (xy[0] < bounds[0]! || xy[0] > bounds[2]! || xy[1] < bounds[1]! || xy[1] > bounds[3]!)) { region = 'america'; reset(); render(); return; }
        const at = proj(xy), v = view();
        if (focus || at[0] < v.left || at[0] > v.left + v.width || at[1] < v.top || at[1] > v.top + v.height) { pan = [at[0] - 500 + (viewport.clientWidth>650?120:0) / zoom, at[1] - 310]; }
      }
      details(p); setView();
      if(window.matchMedia('(max-width:650px)').matches) drawer.scrollIntoView({block:'nearest'});
    }
    function details(p?: Point) {
      drawer.replaceChildren(); drawer.hidden = !p; stage.classList.toggle('has-selection', Boolean(p)); if (!p) return;
      button(drawer, '×', () => { selected = ''; details(); drawMarkers();svg.focus({preventScroll:true}); }, 'sg-atlas-close').setAttribute('aria-label', 'Close place details');
      const m = p.world === 'bom' ? model?.points.find(x => x.id === p.id) : undefined;
      const river=p.id==='sidon'&&world==='bom'?model?.rivers?.[0]:undefined;
      el('span', drawer, p.world === 'bom' ? river ? 'PROPOSED RIVER IDENTIFICATION' : m ? 'PROPOSED LOCATION' : 'LOCATION UNRESOLVED' : p.status.toUpperCase(), 'sg-atlas-eyebrow');
      el('h3', drawer, p.name);if(river)el('p',drawer,`${river.name.split(' · ')[0]} is the river proposed as Sidon in this perspective. The line traces modern river geometry; it does not establish the ancient river's identity or course.`);el('p', drawer, m?.rationale ?? p.note);
      button(drawer, 'Open place page ↗', () => openNote(p.path), 'sg-atlas-primary');
      if(p.world === 'bom') { photoPreview(p.id); button(drawer, 'Explore research & photos →', () => showResearch(p.id), 'sg-atlas-text-button'); }
      if(p.world === 'bom') evidenceCard(drawer,p.id);
      if(p.id==='nephi-city'||p.id==='zarahemla') button(drawer,'Compare centers, edges & gates ↓',showJourney,'sg-atlas-text-button');
      if (m?.confidence) el('div', drawer, `Location confidence: ${m.confidence}`, 'sg-atlas-confidence');
      const xy = coordinate(p);
      if (xy) el('p', drawer, `${Math.abs(xy[1]).toFixed(2)}° ${xy[1] < 0 ? 'S' : 'N'} · ${Math.abs(xy[0]).toFixed(2)}° ${xy[0] < 0 ? 'W' : 'E'}${m ? ' · hypothetical anchor' : ' · approximate anchor'}`, 'sg-atlas-small');
      else if(!river) el('p', drawer, 'No defensible pin in this perspective. The place and its sources remain connected here.', 'sg-atlas-small');
      const evidence = el('details', drawer, '', 'sg-atlas-evidence'); el('summary', evidence, 'Scripture & evidence');
      if (m) el('p', evidence, p.note);
      const links = el('div', evidence, '', 'sg-atlas-sources'); sourceLinks(links, p.ref);
      if(m?.sourceRoles?.length) for(const source of m.sourceRoles) external(links,source.role+' ↗',source.url);
      else for (const ref of m?.refs ?? []) sourceLinks(links, ref);
      if (m?.uncertaintyKm) el('p', evidence, `The ${m.uncertaintyKm} km search radius is an illustrative modeling allowance, not a measured error bound.`);
    }
    function photoPreview(id:string) {
      const photo=researchPhotoFor(id);if(!photo)return;
      const b=button(drawer,'',()=>showResearch(id),'sg-atlas-place-photo');b.setAttribute('aria-label',`See photographs and research for ${photo.site}`);
      const img=el('img',b);img.src=photo.image;img.alt=photo.alt;img.loading='lazy';el('span',b,'View photos & evidence →');
    }
    function pickPhysical(item:PhysicalEvidence,focus=false){
      selected=item.id;directoryOpen=false;query='';search.value='';resultPanel.hidden=true;directory.hidden=true;
      if(focus){const at=proj([item.lon,item.lat]);pan=[at[0]-500,at[1]-310];}
      drawer.replaceChildren();drawer.hidden=false;stage.classList.add('has-selection');
      button(drawer,'×',()=>{selected='';details();drawMarkers();svg.focus({preventScroll:true});},'sg-atlas-close').setAttribute('aria-label','Close evidence details');
      el('span',drawer,'PHYSICAL EVIDENCE · MODERN SITE','sg-atlas-eyebrow');el('h3',drawer,item.name);
      photoPreview(item.id);
      el('div',drawer,item.dateRange,'sg-atlas-confidence');el('p',drawer,item.summary);
      el('p',drawer,item.connectionStatus==='dating-conflict'?'The published date conflicts with an early first-century event.':item.connectionStatus.replace(/-/g,' '));
      button(drawer,'Open evidence page ↗',()=>openNote(item.path),'sg-atlas-primary');
      button(drawer,'Explore photos & references →',()=>showResearch(item.id),'sg-atlas-text-button');
      const sources=el('details',drawer,'','sg-atlas-evidence');el('summary',sources,'Dating & sources');el('p',sources,item.datePrecision);el('p',sources,item.coordinateMeaning);
      for(const url of item.sourceUrls)external(el('p',sources),'Read study ↗',url);
      setView();if(window.matchMedia('(max-width:650px)').matches)drawer.scrollIntoView({block:'nearest'});
    }
    function locatePhysical(item:PhysicalEvidence){
      if(world==='old'||!evidenceVisible){world='new';region='america';evidenceVisible=true;selected=item.id;focusEvidence=item.id;reset();zoom=5;render();return;}
      const xy=proj([item.lon,item.lat]),v=view();
      if(xy[0]<v.left||xy[0]>v.left+v.width||xy[1]<v.top||xy[1]>v.top+v.height){world='new';region='america';selected=item.id;focusEvidence=item.id;reset();zoom=5;render();return;}
      pickPhysical(item,true);
    }
    function renderResults() {
      resultPanel.replaceChildren(); resultPanel.hidden = !query.trim(); if (!query.trim()) return;
      const matches = data.points.filter(p => p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
      const physicalMatches=physicalEvidence.filter(p=>p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
      el('span', resultPanel, `${matches.length+physicalMatches.length} places and evidence sites`, 'sg-atlas-small');
      for(const item of physicalMatches){const row=button(resultPanel,'',()=>locatePhysical(item),'sg-atlas-result');el('span',row,item.name);el('small',row,'Evidence site');}
      for (const p of matches) { const row = button(resultPanel, '', () => pick(p, true), 'sg-atlas-result'); el('span', row, p.name); el('small', row, p.world === 'bom' ? 'Book of Mormon' : p.world === 'old' ? 'Old World' : p.world === 'new' ? 'New World' : 'Unplaced'); }
      if (!matches.length&&!physicalMatches.length) el('p', resultPanel, 'No places found. Try a shorter name.');
    }
    search.oninput = () => { query = search.value; renderResults(); }; search.onfocus = renderResults;
    search.onkeydown = e => { if (e.key === 'Escape') { query = ''; search.value = ''; renderResults(); } if (e.key === 'Enter') resultPanel.querySelector('button')?.click(); };
    function renderDirectory() {
      directory.replaceChildren(); directory.hidden = !directoryOpen; if (!directoryOpen) return;
      button(directory, '×', () => { directoryOpen = false; renderDirectory(); }, 'sg-atlas-close').setAttribute('aria-label', 'Close place directory');
      el('h3', directory, 'Explore places');
      el('p', directory, `${shown.length} in this collection · search above covers all ${data.points.length}`, 'sg-atlas-small');
      if(world!=='old'){const sites=el('details',directory,'','sg-atlas-evidence-directory');el('summary',sites,'Volcanoes & physical evidence');for(const item of physicalEvidence){const row=button(sites,'',()=>locatePhysical(item),'sg-atlas-result');el('span',row,item.name);el('small',row,'View site');}}
      for (const p of [...shown].sort((a, b) => a.name.localeCompare(b.name))) { const row = button(directory, '', () => pick(p, true), 'sg-atlas-result'); el('span', row, p.name); el('small', row, coordinate(p) ? 'View on map' : 'Unplaced · open details'); }
    }
    function drawMarkers() {
      marks.replaceChildren(); halos.replaceChildren();
      const v = view(); const unit = 1 / (Math.min(viewport.clientWidth / v.width, viewport.clientHeight / v.height) || zoom);
      const occupied: number[][] = [];
      const anchors=shown.flatMap(p=>{const ll=coordinate(p);return ll?[{id:p.id,xy:proj(ll)}]:[];});
      if(evidenceVisible&&world!=='old')for(const item of physicalEvidence)anchors.push({id:item.id,xy:proj([item.lon,item.lat])});
      // Keep generous targets where there is room; never let an invisible target cover a neighbour's center.
      function targetRadius(id:string,xy:XY){return Math.max(4,Math.min(22,...anchors.filter(a=>a.id!==id).map(a=>Math.hypot(a.xy[0]-xy[0],a.xy[1]-xy[1])/unit*.48)))*unit;}
      const markerBoxes=anchors.map(a=>{const radius=targetRadius(a.id,a.xy);return[a.xy[0]-radius,a.xy[1]+radius,2*radius,2*radius];});
      const collides = (x: number, y: number, width: number, height: number) => [...occupied, ...markerBoxes].some(o => x < o[0]! + o[2]! && x + width > o[0]! && y - height < o[1]! && y > o[1]! - o[3]!);
      const sorted = [...shown].sort((a, b) => Number(b.id === selected) - Number(a.id === selected) || a.name.localeCompare(b.name));
      for (const p of sorted) {
        const ll = coordinate(p); if (!ll) continue; const xy = proj(ll);
        if (xy[0] < v.left || xy[0] > v.left + v.width || xy[1] < v.top || xy[1] > v.top + v.height) continue;
        const chosen = selected === p.id;
        const m = world === 'bom' ? model?.points.find(x => x.id === p.id) : undefined;
        if (m?.uncertaintyKm && uncertainty) {
          const edge = proj([ll[0] + m.uncertaintyKm / (111.195 * Math.cos(ll[1] * Math.PI / 180)), ll[1]]);
          svgEl('circle', halos, { cx: xy[0], cy: xy[1], r: Math.abs(edge[0] - xy[0]), fill: '#a96730', 'fill-opacity': chosen ? .14 : .045, stroke: '#8c6039', 'stroke-opacity': chosen ? .55 : .24, 'stroke-width': unit, 'stroke-dasharray': `${3 * unit} ${4 * unit}` });
        }
        const g = svgEl('g', marks, { 'data-place': p.id, tabindex: 0, role: 'button', 'aria-label': `${p.name}${m ? ', proposed location' : ''}`, 'aria-pressed': String(chosen), class: 'sg-atlas-pin' });
        if (chosen) svgEl('circle', g, { cx: xy[0], cy: xy[1], r: 13 * unit, fill: '#fff7dc', 'fill-opacity': .8 });
        svgEl('circle', g, { cx: xy[0], cy: xy[1], r: (chosen ? 6 : 4.2) * unit, fill: world === 'bom' ? '#954c2c' : '#28565d', stroke: '#fff9e9', 'stroke-width': 1.7 * unit });
        svgEl('circle', g, { cx: xy[0], cy: xy[1], r: targetRadius(p.id,xy), fill: 'transparent' });
        svgEl('title', g, {}, p.name);
        if (labels || chosen) {
          const width = (p.name.length * 7.2 + 10) * unit, height = 18 * unit;
          const offset=(targetRadius(p.id,xy)/unit+3)*unit;
          const spots = [[xy[0] + offset, xy[1] + 4 * unit], [xy[0] - width - offset, xy[1] + 4 * unit], [xy[0] - width / 2, xy[1] - offset], [xy[0] - width / 2, xy[1] + offset+height]];
          const spot = spots.find(s => s[0]! >= v.left + 8 * unit && s[0]! + width <= v.left + v.width - 8 * unit && s[1]! - height >= v.top && s[1]! <= v.top + v.height && !collides(s[0]!,s[1]!,width,height)) ?? (chosen ? spots[0] : undefined);
          if (spot) { svgEl('text', g, { x: spot[0]!, y: spot[1]!, 'font-size': 13 * unit, 'stroke-width': 3.5 * unit, class: 'sg-atlas-map-label', 'font-weight': chosen ? 700 : 550 }, p.name); occupied.push([spot[0]!, spot[1]!, width, height]); }
        }
        g.addEventListener('click', () => pick(p)); g.addEventListener('keydown', e => { const key = (e as KeyboardEvent).key; if (key === 'Enter' || key === ' ') { e.preventDefault(); pick(p);drawer.querySelector('button')?.focus({preventScroll:true}); } });
      }
      if (world === 'bom') for (const river of model?.rivers ?? []) {
        const line = [...river.coordinates].sort((a,b) => b.length - a.length)[0];
        if (!line?.length) continue;
        const shortName=river.name.split(' · ')[0]!;
        const width = (shortName.length * 7 + 8) * unit, height = 17 * unit;
        const spots = [.5,.35,.65,.2,.8].flatMap(f => { const xy = proj(line[Math.min(line.length-1,Math.floor(line.length*f))]!); return [[xy[0]+7*unit,xy[1]-10*unit],[xy[0]-width-7*unit,xy[1]+18*unit]]; });
        const spot = spots.find(s => s[0]! >= v.left && s[0]!+width <= v.left+v.width && s[1]!-height >= v.top && s[1]! <= v.top+v.height && !collides(s[0]!,s[1]!,width,height));
        if (labels && spot) {
          const label=svgEl('text', marks, {x: spot[0]!, y: spot[1]!, 'font-size': 12 * unit, 'font-style': 'italic', class: 'sg-atlas-river-label', 'stroke-width': 3 * unit,'data-place':'sidon',tabindex:0,role:'button','aria-label':`${shortName}, proposed Sidon, open details`}, shortName);
          const openRiver=()=>{const p=data.points.find(p=>p.id==='sidon');if(p)pick(p);};label.addEventListener('click',openRiver);label.addEventListener('keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();openRiver();drawer.querySelector('button')?.focus({preventScroll:true});}});
          occupied.push([spot[0]!,spot[1]!,width,height]);
        }
      }
      if (evidenceVisible && (world === 'bom' || world === 'new')) for (const item of physicalEvidence) {
        const xy = proj([item.lon,item.lat]); if (xy[0] < v.left || xy[0] > v.left + v.width || xy[1] < v.top || xy[1] > v.top + v.height) continue;
        const g = svgEl('g', marks, {'data-evidence': item.id, 'data-place': item.id, role:'button', tabindex:0, 'aria-label': `${item.name}, physical evidence`, class:'sg-atlas-pin'});
        svgEl('path',g,{d:`M${xy[0]},${xy[1]-8*unit} L${xy[0]+8*unit},${xy[1]+6*unit} L${xy[0]-8*unit},${xy[1]+6*unit} Z`,fill:'#6a4769',stroke:'#fff6e4','stroke-width':1.5*unit});
        svgEl('circle',g,{cx:xy[0],cy:xy[1],r:targetRadius(item.id,xy),fill:'transparent'});
        svgEl('title',g,{},`${item.name} · ${item.dateRange}`);
        if(labels){const name=item.name.split(' · ')[0]!,width=(name.length*7+8)*unit,height=17*unit;
          const offset=targetRadius(item.id,xy)+3*unit;
          const spots=[[xy[0]+offset,xy[1]+4*unit],[xy[0]-width-offset,xy[1]+4*unit],[xy[0]-width/2,xy[1]-offset]];
          const spot=spots.find(s=>s[0]!>=v.left&&s[0]!+width<=v.left+v.width&&s[1]!-height>=v.top&&s[1]!<=v.top+v.height&&!collides(s[0]!,s[1]!,width,height));
          if(spot){svgEl('text',g,{x:spot[0]!,y:spot[1]!,'font-size':12*unit,'stroke-width':3.5*unit,class:'sg-atlas-map-label'},name);occupied.push([spot[0]!,spot[1]!,width,height]);}}
        const pickEvidence = () => pickPhysical(item);
        g.addEventListener('click',pickEvidence);g.addEventListener('keydown',e=>{if(['Enter',' '].includes((e as KeyboardEvent).key)){e.preventDefault();pickEvidence();drawer.querySelector('button')?.focus({preventScroll:true});}});
      }
    }
    function screenAnchor(x: number, y: number): XY {
      const rect = svg.getBoundingClientRect(); const ratio = Math.min(rect.width / baseWidth, rect.height / baseHeight);
      return [500+(x-rect.left-rect.width/2)/ratio,310+(y-rect.top-rect.height/2)/ratio];
    }
    interactions=attachMapInteractions(svg,{
      getView:()=>({zoom,pan}),setView:v=>{zoom=v.zoom;pan=v.pan;setView();},screenToBase:screenAnchor,
      isInteractive:()=>mapActive||fullscreen.open,
      onDraggingChange:active=>svg.classList.toggle('is-dragging',active),
      onScrollHint:()=>{interactionHint.textContent='Use Ctrl / ⌘ + scroll to zoom, or choose Move map';}
    });
    refreshInteractionMode();
    svg.onkeydown = e => { if (e.target !== svg || !['+', '=', '-', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(e.key)) return; const move = 45 / zoom;e.preventDefault(); if (e.key === '+' || e.key === '=') zoomTo(zoom * 1.5); if (e.key === '-') zoomTo(zoom / 1.5); if (e.key === 'ArrowLeft') pan[0] -= move; if (e.key === 'ArrowRight') pan[0] += move; if (e.key === 'ArrowUp') pan[1] -= move; if (e.key === 'ArrowDown') pan[1] += move; if (e.key === 'Home') reset(); setView(); };
    details(data.points.find(p => p.id === selected)); renderResults(); renderDirectory(); setView();
    const selectedPhysical=physicalEvidence.find(p=>p.id===selected);
    if(selectedPhysical){pickPhysical(selectedPhysical,focusEvidence===selected);focusEvidence='';}
    if (typeof ResizeObserver !== 'undefined') { resize = new ResizeObserver(setView); resize.observe(viewport); }
  }
  render();
  return () => { disposed = true; closeResearch?.();interactions?.dispose();resize?.disconnect(); fullscreen.close(); fullscreen.remove(); root.remove(); home.remove(); };
}
