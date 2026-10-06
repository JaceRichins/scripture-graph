import { distanceKm } from './math';
import { settlementDistances } from './settlement-distance';

interface Anchor {lon:number;lat:number;uncertaintyKm?:number;modernName?:string}
export interface CityTravelSettings { departure:number;arrival:number;factor:number;rate:number;includeLocation:boolean }
export function renderSettlementTravel(parent:HTMLElement, model:{name:string;id:string}, a:Anchor, b:Anchor, settings:CityTravelSettings, openNote:(path:string)=>void) {
  function node<K extends keyof HTMLElementTagNameMap>(tag:K, into:Element, text='') {const n=document.createElement(tag);n.textContent=text;into.append(n);return n;}
  function link(into:Element,title:string,url:string) {const n=node('a',into,title);n.href=url;n.target='_blank';n.rel='noopener noreferrer';}
  parent.classList.add('sg-atlas-city-travel');
  node('h3',parent,'Where does the journey begin and end?');
  node('p',parent,`${model.name}: proposed Nephi (${a.modernName ?? 'candidate'}) → proposed Zarahemla (${b.modernName ?? 'candidate'}).`);
  node('p',parent,'Try city edges, uncertain gates, or crossing the destination. The starting 1 km radii are illustrative assumptions, not excavated boundaries. Radius means center to edge; diameter is twice that.');
  const controls=node('div',parent);controls.className='sg-atlas-travel-inputs';
  function number(label:string,key:'departure'|'arrival'|'factor'|'rate',min:number,max:number,step:number) {
    const wrap=node('label',controls,label);const field=node('input',wrap);field.type='number';field.min=String(min);field.max=String(max);field.step=String(step);field.value=String(settings[key]);
    field.oninput=()=>{if(!field.checkValidity()||field.value===''){field.setAttribute('aria-invalid','true');results.hidden=true;error.hidden=false;return;}field.removeAttribute('aria-invalid');settings[key]=field.valueAsNumber;update();};
    return field;
  }
  const fields=[number('Nephi assumed radius (km)','departure',0,25,.1),number('Zarahemla assumed radius (km)','arrival',0,25,.1),number('Route length multiplier','factor',1,3,.1),number('Assumed travel (km/day)','rate',1,80,1)];
  const checkWrap=node('label',parent);checkWrap.className='sg-atlas-location-toggle';const check=node('input',checkWrap);check.type='checkbox';check.checked=settings.includeLocation;
  checkWrap.append(' Also include uncertainty in the candidate locations');check.onchange=()=>{settings.includeLocation=check.checked;update();};
  const error=node('p',parent,'Enter valid numbers in all four fields to calculate.');error.hidden=true;error.setAttribute('role','status');
  const results=node('div',parent);results.setAttribute('aria-live','polite');
  const centerDistance=distanceKm([a.lon,a.lat],[b.lon,b.lat]);
  const allowance=(a.uncertaintyKm??0)+(b.uncertaintyKm??0);
  const format=(values:number[])=>Math.abs(values[1]!-values[0]!)<.005 ? values[0]!.toFixed(1) : `${values[0]!.toFixed(1)}–${values[1]!.toFixed(1)}`;
  function update() {
    const valid=fields.every(f=>f.value!==''&&f.checkValidity());results.hidden=!valid;error.hidden=valid;if(!valid)return;
    results.replaceChildren();
    node('p',results,`Center separation: ${centerDistance.toFixed(2)} km. Assumed city diameters: ${(settings.departure*2).toFixed(1)} km and ${(settings.arrival*2).toFixed(1)} km.`);
    node('p',results,settings.includeLocation ? `Candidate-location allowance: ±${allowance} km in center separation, from the two editorial search radii combined. This is additional to city size and is not a statistical interval.` : 'Candidate locations are held fixed. Only the endpoint and city-size assumptions below vary.');
    const table=node('table',results);table.className='sg-atlas-distance-table';const caption=node('caption',table,'Conditional distances and moving days');
    caption.className='sg-atlas-small';const head=node('tr',node('thead',table));for(const name of ['Endpoints','Direct km','Route km','Days'])node('th',head,name).scope='col';
    const body=node('tbody',table);
    for(const row of settlementDistances({centerKm:centerDistance,departureRadiusKm:settings.departure,arrivalRadiusKm:settings.arrival,centerAllowanceKm:settings.includeLocation?allowance:0,routeFactor:settings.factor,kmPerDay:settings.rate})) {
      const tr=node('tr',body);node('th',tr,row.label).scope='row';
      for(const values of [row.straightKm,row.routeKm,row.days])node('td',tr,values?format(values):'Not applicable');
    }
    node('p',results,`Crossing the arrival city adds ${(settings.arrival*2).toFixed(1)} direct km beyond first entry in the simple diameter scenario. Streets and gates may require a different path. If the city areas overlap, this crossing scenario is not calculated.`);
  }
  update();
  node('p',parent,'The shortest edge-to-edge gap is not necessarily a usable route. “Unknown” gives a broad envelope for endpoints inside assumed circular areas; it does not place gates at the extremes. Route km multiply direct distance by your chosen factor. Days exclude stops and are scenario outputs, not verified travel times.');
  const limits=node('details',parent);node('summary',limits,'What archaeology and scripture actually tell us');
  if(model.id==='sorenson-grijalva') node('p',limits,'Santa Rosa: the excavation reassessment reports about 0.9 × 0.6 km of site extent. That is a scale reference, not the occupied city boundary at every date. The current rounded map pin is not established as the footprint center.');
  else node('p',limits,'Nueva Esperanza/Calatraba: the proponent reports about 200 hectares (2 km²). This is not an independently verified contemporary city footprint. Area alone cannot tell us the length of a narrow or irregular settlement.');
  node('p',limits,'Kaminaljuyu: no phase-specific city boundary or gate pair has been verified for this calculator. Larger settlement dimensions may be explored, but must remain assumptions until supported. No inferred boundaries are drawn on the map.');
  node('p',limits,'Arriving in a land is a different endpoint: its boundary is unlocated here, so no city radius is substituted and no numerical land-entry distance is reported. This calculator does not validate a combined 21-day journey from Nephi city.');
  link(limits,'Mosiah 7:5–10, 16: hill, gate and city entry ↗','https://www.churchofjesuschrist.org/study/scriptures/bofm/mosiah/7?lang=eng');
  node('br',limits);link(limits,'Mosiah 22:6–13: back passage and arrival in a land ↗','https://www.churchofjesuschrist.org/study/scriptures/bofm/mosiah/22?lang=eng');
  node('br',limits);link(limits,'Mosiah 24:20–25: valley and land of Zarahemla ↗','https://www.churchofjesuschrist.org/study/scriptures/bofm/mosiah/24?lang=eng');
  const read=node('button',parent,'Read the city-size and journey audit ↗');read.type='button';read.className='sg-atlas-text-button';read.onclick=()=>openNote('AI Library/91 Maps/City boundaries and travel distances.md');
}
