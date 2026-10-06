import test from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'esbuild';
import { readFileSync } from 'node:fs';

// Transpile in memory so tests exercise the shipped TypeScript without generated files.
const result = await transform(readFileSync(new URL('../src/study/atlas/map-interactions.ts',import.meta.url),'utf8'),{loader:'ts',format:'esm'});
const api = await import('data:text/javascript;base64,'+Buffer.from(result.code).toString('base64'));
const {viewForGesture,permitsMapWheel,wheelZoomFactor,hasDragDistance,attachMapInteractions}=api;
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

function event(type,properties={}) {const e=new Event(type,{cancelable:true});Object.assign(e,properties);return e;}
function harness() {
  const win=new EventTarget(),doc=new EventTarget();doc.defaultView=win;doc.visibilityState='visible';
  const marker={name:'marker'},svg=new EventTarget(),captured=new Set();
  Object.assign(svg,{ownerDocument:doc,style:{touchAction:'pan-y'},clientHeight:620,closest:()=>marker,
    setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)});
  let view={zoom:1,pan:[0,0]},interactive=true,updates=0;const taps=[],dragStates=[];
  const handle=attachMapInteractions(svg,{getView:()=>view,setView:next=>{view=next;updates++;},screenToBase:(x,y)=>[x,y],isInteractive:()=>interactive,onTap:target=>taps.push(target),onDraggingChange:value=>dragStates.push(value)});
  const send=(type,x,y,id=1,extra={})=>{const e=event(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0,...extra});(type==='pointerdown'||type==='lostpointercapture'?svg:win).dispatchEvent(e);return e;};
  return {svg,win,doc,marker,captured,handle,send,taps,dragStates,get view(){return view;},get updates(){return updates;},setInteractive(value){interactive=value;handle.refreshMode();}};
}

test('pinch keeps the same world coordinate beneath its moving midpoint',()=>{
  const frame={view:{zoom:2,pan:[32,-17]},anchor:[700,410],distance:100};
  const current=[760,430],out=viewForGesture(frame,current,200);
  close(out.zoom,4);
  for(let i=0;i<2;i++){const center=[500,310][i];close(center+frame.view.pan[i]+(frame.anchor[i]-center)/2,center+out.pan[i]+(current[i]-center)/out.zoom);}
});
test('clamped pinch still preserves anchor instead of drifting at max zoom',()=>{
  const frame={view:{zoom:20,pan:[0,0]},anchor:[200,100],distance:20};
  const out=viewForGesture(frame,[300,200],200,[500,310],1,24);
  assert.equal(out.zoom,24);close(500+(200-500)/20,500+out.pan[0]+(300-500)/24);
});
test('one-finger drag is scale independent and small jitter is below tap threshold',()=>{
  const moved=viewForGesture({view:{zoom:3,pan:[5,8]},anchor:[100,100]},[160,130]);assert.equal(moved.zoom,3);close(moved.pan[0],-15);close(moved.pan[1],-2);
  assert.equal(hasDragDistance([0,0],[3,4],6),false);assert.equal(hasDragDistance([0,0],[7,0],6),true);
});
test('plain wheel is page scrolling until explicitly interactive',()=>{
  assert.equal(permitsMapWheel({ctrlKey:false,metaKey:false},false),false);
  assert.equal(permitsMapWheel({ctrlKey:true,metaKey:false},false),true);
  assert.equal(permitsMapWheel({ctrlKey:false,metaKey:true},false),true);
  assert.equal(permitsMapWheel({ctrlKey:false,metaKey:false},true),true);
  close(wheelZoomFactor(1,1),wheelZoomFactor(16,0));assert.ok(wheelZoomFactor(-100000,0)<2.3);
});
test('a small marker tap activates once without repainting or losing stable SVG capture',()=>{
  const h=harness();h.send('pointerdown',100,100);assert.equal(h.captured.has(1),true);
  h.send('pointermove',104,104);assert.equal(h.updates,0);h.send('pointerup',104,104);
  assert.deepEqual(h.taps,[h.marker]);assert.equal(h.captured.size,0);
  let clicked=0;h.svg.addEventListener('click',()=>clicked++);const click=event('click',{detail:1});h.svg.dispatchEvent(click);
  assert.equal(click.defaultPrevented,true);assert.equal(clicked,0);h.svg.dispatchEvent(event('click',{detail:0}));assert.equal(clicked,1);h.handle.dispose();
});
test('drag can begin on a marker and never accidentally selects it on release',()=>{
  const h=harness();h.send('pointerdown',100,100);h.send('pointermove',160,130);h.send('pointerup',160,130);
  assert.equal(h.taps.length,0);assert.deepEqual(h.view.pan,[-60,-30]);assert.deepEqual(h.dragStates,[true,false]);h.handle.dispose();
});
test('fast release displacement without pointermove is still not a tap',()=>{
  const h=harness();h.send('pointerdown',100,100);h.send('pointerup',125,100);assert.equal(h.taps.length,0);h.handle.dispose();
});
test('pinch-to-one-finger transition rebases without jump or accidental tap',()=>{
  const h=harness();h.send('pointerdown',100,100,1);h.send('pointerdown',200,100,2);h.send('pointermove',300,100,2);
  assert.equal(h.view.zoom,2);const before=[...h.view.pan];h.send('pointerup',300,100,2);h.send('pointermove',120,100,1);
  close(h.view.pan[0],before[0]-10);close(h.view.pan[1],before[1]);h.send('pointerup',120,100,1);assert.equal(h.taps.length,0);h.handle.dispose();
});
test('pointercancel clears all captures; next gesture starts clean',()=>{
  const h=harness();h.send('pointerdown',100,100,1);h.send('pointerdown',200,100,2);h.send('pointercancel',100,100,1);
  assert.equal(h.captured.size,0);h.send('pointerup',200,100,2);assert.equal(h.taps.length,0);
  h.send('pointerdown',100,100,3);h.send('pointerup',100,100,3);assert.equal(h.taps.length,1);h.handle.dispose();
});
test('embedded touch and wheel are not consumed; modifier wheel zooms',()=>{
  const h=harness();h.setInteractive(false);const down=h.send('pointerdown',100,100);assert.equal(down.defaultPrevented,false);assert.equal(h.captured.size,0);
  const plain=event('wheel',{ctrlKey:false,metaKey:false,deltaY:100,deltaMode:0,clientX:500,clientY:310});h.svg.dispatchEvent(plain);
  assert.equal(plain.defaultPrevented,false);assert.equal(h.updates,0);
  const ctrl=event('wheel',{ctrlKey:true,metaKey:false,deltaY:-100,deltaMode:0,clientX:500,clientY:310});h.svg.dispatchEvent(ctrl);
  assert.equal(ctrl.defaultPrevented,true);assert.ok(h.view.zoom>1);h.handle.dispose();
});
test('lost capture, visibility loss and dispose clean up without stale gesture listeners',()=>{
  const h=harness();h.send('pointerdown',100,100);h.send('lostpointercapture',100,100);assert.equal(h.captured.size,0);
  h.send('pointerdown',100,100);h.doc.visibilityState='hidden';h.doc.dispatchEvent(new Event('visibilitychange'));assert.equal(h.captured.size,0);
  h.handle.dispose();h.send('pointerdown',100,100);h.send('pointermove',200,100);assert.equal(h.updates,0);assert.equal(h.svg.style.touchAction,'pan-y');
});
