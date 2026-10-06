/** Pointer coordination is separate from rendering: marker nodes may be replaced every frame. */
export type MapPosition = [number, number];
export interface MapView { zoom: number; pan: MapPosition }
export interface GestureFrame {
  view: MapView;
  /** Pointer midpoint in the unzoomed projection coordinate system. */
  anchor: MapPosition;
  /** Initial two-pointer distance in CSS pixels; omitted for a one-pointer drag. */
  distance?: number;
}
export interface MapInteractionOptions {
  getView(): MapView;
  setView(view: MapView): void;
  /** Converts client pixels to the base view, ignoring current zoom/pan. */
  screenToBase(clientX: number, clientY: number): MapPosition;
  /** True for fullscreen or an explicitly activated map. Embedded touch otherwise scrolls the page. */
  isInteractive(): boolean;
  center?: MapPosition;
  minZoom?: number;
  maxZoom?: number;
  tapThreshold?: number;
  /** Omit to invoke the original [data-place]/[data-evidence] element's click handler once. */
  onTap?(target: Element | null, event: PointerEvent): void;
  onDraggingChange?(dragging: boolean): void;
  /** Optional short hint, e.g. “Use Ctrl + scroll to zoom”. Does not consume the wheel event. */
  onScrollHint?(): void;
}
export interface MapInteractionHandle {
  dispose(): void;
  cancel(): void;
  /** Call after opening/closing fullscreen or toggling interactive mode. */
  refreshMode(): void;
}

export function hasDragDistance(start: MapPosition, point: MapPosition, threshold: number): boolean {
  return Math.hypot(point[0] - start[0], point[1] - start[1]) > threshold;
}
export function permitsMapWheel(event: {ctrlKey: boolean; metaKey: boolean}, interactive: boolean): boolean {
  return interactive || event.ctrlKey || event.metaKey;
}
/** Normalize line/page wheel units and bound abrupt hardware deltas. */
export function wheelZoomFactor(deltaY: number, deltaMode: number, pageHeight = 620): number {
  const pixels = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? pageHeight : 1);
  return Math.exp(-Math.max(-400, Math.min(400, pixels)) * .002);
}
/** Preserve the world point beneath the initial midpoint while the pinch moves and scales. */
export function viewForGesture(frame: GestureFrame, anchor: MapPosition, distance?: number,
  center: MapPosition = [500, 310], minZoom = 1, maxZoom = 24): MapView {
  const factor = frame.distance && distance !== undefined ? distance / frame.distance : 1;
  const zoom = Math.max(minZoom, Math.min(maxZoom, frame.view.zoom * factor));
  return {zoom, pan: [
    frame.view.pan[0] + (frame.anchor[0] - center[0]) / frame.view.zoom - (anchor[0] - center[0]) / zoom,
    frame.view.pan[1] + (frame.anchor[1] - center[1]) / frame.view.zoom - (anchor[1] - center[1]) / zoom,
  ]};
}

export function attachMapInteractions(svg: SVGSVGElement, options: MapInteractionOptions): MapInteractionHandle {
  const win = svg.ownerDocument.defaultView;
  const moveTarget: EventTarget = win ?? svg;
  const center = options.center ?? [500, 310];
  const minZoom = options.minZoom ?? 1, maxZoom = options.maxZoom ?? 24;
  const oldTouchAction = svg.style.touchAction;
  const pointers = new Map<number, MapPosition>();
  let frame: GestureFrame | undefined;
  let firstPoint: MapPosition | undefined, downTarget: Element | null = null;
  let moved = false, multiple = false, dragging = false, disposed = false;
  let tapThreshold = options.tapThreshold ?? 6, startedAt = 0, suppressUntil = 0, lastHint = -Infinity;
  const now = () => Date.now();
  const copyView = (): MapView => { const view = options.getView(); return {zoom:view.zoom,pan:[...view.pan]}; };
  function updateDragging(value: boolean) {
    if (dragging !== value) { dragging=value;options.onDraggingChange?.(value); }
  }
  function midpoint(): {point: MapPosition; distance?: number} | undefined {
    const values = [...pointers.values()], a = values[0], b = values[1];
    if (!a) return undefined;
    return b ? {point:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(a[0]-b[0],a[1]-b[1])} : {point:a};
  }
  function rebase() {
    const position = midpoint();
    frame = position ? {view:copyView(),anchor:options.screenToBase(...position.point),distance:position.distance} : undefined;
  }
  function release(id: number) {
    try { if (svg.hasPointerCapture(id)) svg.releasePointerCapture(id); } catch { /* Detached SVG or already released. */ }
  }
  function cancel() {
    if (pointers.size) suppressUntil=now()+700;
    const ids=[...pointers.keys()];pointers.clear();frame=undefined;firstPoint=undefined;downTarget=null;
    moved=false;multiple=false;updateDragging(false);for(const id of ids)release(id);
  }
  function refreshMode() {
    svg.style.touchAction = options.isInteractive() ? 'none' : 'pan-y pinch-zoom';
    if (!options.isInteractive()) cancel();
  }
  function markerTarget(target: EventTarget | null): Element | null {
    const element=target as Element | null;
    return typeof element?.closest === 'function' ? element.closest('[data-place], [data-evidence]') : null;
  }
  function onDown(event: Event) {
    const e=event as PointerEvent;
    if(disposed || e.button !== 0 || (e.pointerType==='touch' && !options.isInteractive()))return;
    // The SVG, never a marker, owns capture. Its children may disappear during setView.
    if (!pointers.size) {
      moved=false;multiple=false;firstPoint=[e.clientX,e.clientY];downTarget=markerTarget(e.target);startedAt=now();
      tapThreshold=options.tapThreshold ?? (e.pointerType==='touch'?9:6);
    }
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if(pointers.size>1){multiple=true;moved=true;updateDragging(true);}
    rebase();
    try { svg.setPointerCapture(e.pointerId); } catch { /* Window listeners provide a fallback. */ }
    // Suppress browser compatibility gestures only after deciding to own this gesture.
    if(e.cancelable)e.preventDefault();
  }
  function onMove(event: Event) {
    const e=event as PointerEvent;
    if(!pointers.has(e.pointerId)||!frame)return;
    pointers.set(e.pointerId,[e.clientX,e.clientY]);
    if(!moved && firstPoint && hasDragDistance(firstPoint,[e.clientX,e.clientY],tapThreshold)){moved=true;updateDragging(true);}
    if(!moved)return;
    const position=midpoint();if(!position)return;
    if(e.cancelable)e.preventDefault();
    options.setView(viewForGesture(frame,options.screenToBase(...position.point),position.distance,center,minZoom,maxZoom));
  }
  function onUp(event: Event) {
    const e=event as PointerEvent;
    if(!pointers.has(e.pointerId))return;
    // A fast release can arrive without a final pointermove.
    if(firstPoint&&hasDragDistance(firstPoint,[e.clientX,e.clientY],tapThreshold))moved=true;
    pointers.delete(e.pointerId);release(e.pointerId);
    if(pointers.size){rebase();return;}
    const target=downTarget, tap=!moved&&!multiple&&now()-startedAt<650;
    frame=undefined;firstPoint=undefined;downTarget=null;updateDragging(false);
    suppressUntil=now()+700;
    if(tap){
      if(options.onTap)options.onTap(target,e);
      else if(target){
        // detail=0 distinguishes this explicit activation from the subsequent native click.
        const EventConstructor=win?.MouseEvent ?? MouseEvent;
        target.dispatchEvent(new EventConstructor('click',{bubbles:true,cancelable:true,detail:0,clientX:e.clientX,clientY:e.clientY}));
      }
    }
  }
  function onCancel(event: Event) {
    if(pointers.has((event as PointerEvent).pointerId))cancel();
  }
  function onClick(event: Event) {
    const e=event as MouseEvent;
    if(e.detail!==0 && now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}
  }
  function onWheel(event: Event) {
    const e=event as WheelEvent;
    if(!permitsMapWheel(e,options.isInteractive())){
      if(now()-lastHint>2500){lastHint=now();options.onScrollHint?.();}return;
    }
    if(e.cancelable)e.preventDefault();
    const view=copyView(),anchor=options.screenToBase(e.clientX,e.clientY);
    options.setView(viewForGesture({view,anchor,distance:1},anchor,wheelZoomFactor(e.deltaY,e.deltaMode,svg.clientHeight),center,minZoom,maxZoom));
    // A wheel during a held drag starts a fresh frame, avoiding a jump next pointermove.
    rebase();
  }
  function onVisibility() { if(svg.ownerDocument.visibilityState==='hidden')cancel(); }
  const listeners: [EventTarget,string,EventListener,boolean|AddEventListenerOptions][]=[
    [svg,'pointerdown',onDown,{passive:false}],
    [moveTarget,'pointermove',onMove,{passive:false}],
    [moveTarget,'pointerup',onUp,false],
    [moveTarget,'pointercancel',onCancel,false],
    [svg,'lostpointercapture',onCancel,false],
    [svg,'click',onClick,true],
    [svg,'wheel',onWheel,{passive:false}],
    [svg.ownerDocument,'visibilitychange',onVisibility,false],
  ];
  if(win)listeners.push([win,'blur',cancel,false]);
  for(const [target,type,listener,settings]of listeners)target.addEventListener(type,listener,settings);
  refreshMode();
  return {cancel,refreshMode,dispose(){
    if(disposed)return;disposed=true;cancel();
    for(const [target,type,listener,settings]of listeners)target.removeEventListener(type,listener,settings);
    svg.style.touchAction=oldTouchAction;
  }};
}
