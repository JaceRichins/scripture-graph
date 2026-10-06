import photoData from './research-photos.json';
import figureData from './research-figures.json';
import evidenceGuide from './evidence-guide.json';

export interface ResearchPhoto {
  id: string; title: string; site: string; category: string; evidenceType: string;
  image: string; alt: string; caption: string; support: string; limit: string;
  source: string; author: string; date: string; license: string; licenseUrl: string;
  research: string; researchTitle: string; places: string[]; mapPlace?: string; mapLabel?: string;
  eventDate: string; changes?: string; moreResearch?: {title: string; url: string}[];
}
interface ResearchFigure {
  title: string; caption: string; site: string; category: string; places: string[];
  source: string; figureUrl?: string; credit: string; date: string; limit: string;
}
const photos = photoData as unknown as ResearchPhoto[];
const figures = figureData as unknown as ResearchFigure[];
const categories = [['all','All'],['volcanoes','Volcanoes'],['underwater','Underwater'],['buried','Buried buildings'],['archaeology','Ancient cities']];
const chapters = ['Book of Mormon geography - second investigation', 'Photographs and field evidence', 'Archaeological audit of proposed cities', 'Destruction chronology second investigation', 'Textual geography and competing regions', 'Landscape and distance audit', 'City boundaries and travel distances'];
function el<K extends keyof HTMLElementTagNameMap>(tag: K, parent: Element, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.textContent = text; node.className = cls; parent.append(node); return node;
}
function button(parent: Element, label: string, action: () => void, cls = '') {
  const node=el('button',parent,label,cls);node.type='button';node.onclick=action;return node;
}
function link(parent: Element,label: string,url: string) {
  const a=el('a',parent,label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;
}
export function researchPhotoFor(place: string): ResearchPhoto | undefined { return photos.find(p=>p.places.includes(place)); }

/** Top-layer reader preserves the map's viewport, selection, and scroll position underneath. */
export function openResearchGallery(place: string, options: {openNote(path:string):void;viewMap(id:string):void;closed():void}): () => void {
  const focus=document.activeElement as HTMLElement | null;
  const dialog=document.createElement('dialog');dialog.className='sg-atlas-research-dialog';dialog.setAttribute('aria-label','Photographs and research');document.body.append(dialog);
  const body=el('section',dialog,'','sg-atlas sg-atlas-gallery');
  let section='photos',category='all',related=Boolean(place&&[...photos,...figures].some(p=>p.places.includes(place))),lightbox:HTMLDialogElement|undefined,ended=false;
  function close() { if(ended)return;ended=true;lightbox?.remove();dialog.close();dialog.remove();if(focus?.isConnected)focus.focus({preventScroll:true});options.closed(); }
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  const header=el('header',body,'','sg-atlas-gallery-header');
  const back=button(header,'← Back to map',close,'sg-atlas-browse');
  el('span',header,`${photos.length} photographs · original research`, 'sg-atlas-small');
  el('span',body,'FIELD NOTES', 'sg-atlas-eyebrow');
  el('h2',body,'See the evidence');
  el('p',body,'Explore the landscapes, excavations, and dates behind this reconstruction. Start with a photograph, then follow the original research.', 'sg-atlas-gallery-intro');
  const tabs=el('nav',body,'','sg-atlas-gallery-tabs');tabs.setAttribute('aria-label','Research sections');
  const panel=el('div',body);panel.setAttribute('aria-live','polite');
  const tabButtons=[['photos','Photos & fieldwork'],['reasoning','Why these places?'],['sources','Full investigation']].map(([id,name])=>({id,button:button(tabs,name!,()=>{section=id!;render();})}));
  function openNote(title: string) {close();options.openNote(`AI Library/91 Maps/${title}.md`);}
  function sourceDetails(parent:Element,p:ResearchPhoto) {
    el('strong',parent,'What the photograph shows');el('p',parent,p.caption);
    el('strong',parent,'Why it matters');el('p',parent,p.support);
    el('strong',parent,'What the dates and evidence allow');el('p',parent,p.limit);
    const sources=el('div',parent,'','sg-atlas-photo-sources');
    link(sources,p.researchTitle||'Read the primary research ↗',p.research);
    for(const ref of p.moreResearch??[])link(sources,ref.title+' ↗',ref.url);
    const credit=el('p',parent,`${p.author} · photographed ${p.date} · ${p.changes||'resized only'} · `,'sg-atlas-small');
    link(credit,p.license,p.licenseUrl||p.source);credit.append(' · ');link(credit,'Original photograph ↗',p.source);
  }
  function enlarge(index:number,items:ResearchPhoto[],opener:HTMLElement) {
    lightbox=document.createElement('dialog');lightbox.className='sg-atlas-photo-lightbox';lightbox.setAttribute('aria-label','Enlarged research photograph');document.body.append(lightbox);
    const photoDialog=lightbox;
    let current=index,zoomed=false;
    function dismiss(){photoDialog.close();photoDialog.remove();lightbox=undefined;if(opener.isConnected)opener.focus({preventScroll:true});}
    photoDialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
    photoDialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();current=(current+1)%items.length;draw();}if(e.key==='ArrowLeft'){e.preventDefault();current=(current-1+items.length)%items.length;draw();}});
    function draw(){
      zoomed=false;photoDialog.replaceChildren();const p=items[current]!;
      const content=el('section',photoDialog,'','sg-atlas sg-atlas-photo-reader');
      const bar=el('div',content,'','sg-atlas-lightbox-bar');const closeButton=button(bar,'× Close photo',dismiss,'sg-atlas-browse');
      el('span',bar,`${current+1} / ${items.length}`,'sg-atlas-small');
      const navigation=el('div',bar,'','sg-atlas-lightbox-navigation');
      const previous=button(navigation,'←',()=>{current=(current-1+items.length)%items.length;draw();});previous.setAttribute('aria-label','Previous photograph');previous.disabled=items.length<2;
      const next=button(navigation,'→',()=>{current=(current+1)%items.length;draw();});next.setAttribute('aria-label','Next photograph');next.disabled=items.length<2;
      el('h3',content,p.title);
      const frame=el('div',content,'','sg-atlas-photo-frame');frame.tabIndex=0;frame.setAttribute('aria-label','Photograph; scroll to explore when enlarged');
      const img=el('img',frame);img.src=p.image;img.alt=p.alt;
      const zoomButton=button(content,'Zoom photo',()=>{zoomed=!zoomed;frame.classList.toggle('is-zoomed',zoomed);zoomButton.textContent=zoomed?'Fit photo':'Zoom photo';zoomButton.setAttribute('aria-pressed',String(zoomed));},'sg-atlas-browse');zoomButton.setAttribute('aria-pressed','false');
      el('p',content,p.eventDate,'sg-atlas-photo-date');
      sourceDetails(content,p);closeButton.focus({preventScroll:true});photoDialog.scrollTop=0;
    }
    photoDialog.showModal();draw();
  }
  function render(){
    for(const t of tabButtons)t.button.setAttribute('aria-pressed',String(t.id===section));panel.replaceChildren();
    if(section==='photos'){
      const filter=el('nav',panel,'','sg-atlas-photo-filters');filter.setAttribute('aria-label','Photograph topics');
      for(const [id,name]of categories){const b=button(filter,name!,()=>{category=id!;related=false;render();});b.setAttribute('aria-pressed',String(category===id));}
      if(related){const scope=el('div',panel,'','sg-atlas-gallery-scope');el('span',scope,'Showing research for the selected place');button(scope,'Show everything',()=>{related=false;render();},'sg-atlas-text-button');}
      const matches=(p:{category:string;places:string[]})=>(category==='all'||p.category===category)&&(!related||p.places.includes(place));
      const items=photos.filter(matches),refs=figures.filter(matches);
      const count=el('p',panel,`${items.length} photograph${items.length===1?'':'s'}${refs.length?` · ${refs.length} original fieldwork references`:''} · tap any photo to enlarge`, 'sg-atlas-small');count.setAttribute('role','status');
      const grid=el('div',panel,'','sg-atlas-photo-grid');
      items.forEach((p,i)=>{
        const card=el('article',grid,'','sg-atlas-photo-card');
        const imageButton=button(card,'',()=>enlarge(i,items,imageButton),'sg-atlas-photo-open');imageButton.setAttribute('aria-label',`Enlarge photograph: ${p.title}`);
        const img=el('img',imageButton);img.src=p.image;img.alt=p.alt;img.loading='lazy';
        el('span',imageButton,'⛶ Enlarge','sg-atlas-photo-enlarge');
        el('span',card,p.evidenceType,'sg-atlas-photo-badge');el('h4',card,p.title);
        el('p',card,p.eventDate,'sg-atlas-photo-date');el('p',card,p.support);
        const detail=el('details',card,'','sg-atlas-photo-analysis');el('summary',detail,'Evidence, dates & references');sourceDetails(detail,p);
        if(p.mapPlace)button(card,p.mapLabel||'Locate on map →',()=>{close();options.viewMap(p.mapPlace!);},'sg-atlas-text-button');
      });
      if(refs.length){
        el('h3',panel,'Inside the original field reports');
        el('p',panel,'These links open the researchers’ own figures. Sonar images and excavation plans are identified separately from photographs.','sg-atlas-small');
        const list=el('div',panel,'','sg-atlas-photo-grid');
        for(const f of refs){const card=el('article',list,'','sg-atlas-reference-card');el('span',card,f.site,'sg-atlas-eyebrow');el('h4',card,f.title);el('p',card,f.caption);el('p',card,f.limit);link(card,'Open original report & figures ↗',f.source);if(f.figureUrl)link(card,'View the original figure ↗',f.figureUrl);el('p',card,`${f.credit} · ${f.date}`,'sg-atlas-small');}
      }
      if(!items.length&&!refs.length)el('p',panel,'No photographs in this selection yet. Choose another topic to continue.');
    }else if(section==='reasoning'){
      el('p',panel,'We use the Book of Mormon as a historical account and test proposed locations against its relationships, travel, archaeology, and geology. A real ruin or volcano supports a possibility; matching the place also requires matching its dates and the surrounding geography.');
      const grid=el('div',panel,'','sg-atlas-photo-grid');
      for(const [id,item]of Object.entries(evidenceGuide).sort(([a],[b])=>Number(b===place)-Number(a===place))){
        const card=el('article',grid,'','sg-atlas-evidence-card');el('h4',card,item.title);el('strong',card,'What supports the proposal');el('p',card,item.support);el('strong',card,'What still needs to fit');el('p',card,item.challenge);button(card,'Read the evidence and citations ↗',()=>openNote(item.chapter),'sg-atlas-text-button');
      }
    }else{
      el('h3',panel,'Follow the complete investigation');
      el('p',panel,'Open the vault chapters for the textual constraints, competing regions, excavation audits, chronology, and assumptions behind the map.');
      const nav=el('div',panel,'','sg-atlas-research-nav');
      for(const title of chapters)button(nav,title===chapters[0]?'Investigation overview':title,()=>openNote(title),'sg-atlas-text-button');
      el('p',panel,'Photos are stored with the atlas for offline reading. External papers, original figures, and full-resolution photographs need an internet connection.','sg-atlas-small');
    }
  }
  dialog.showModal();render();back.focus({preventScroll:true});return close;
}
