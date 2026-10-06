import type { Subject, TimelineData, TimelineEvent } from './timelineView';
import { timelineConnections } from './timelineConnections';
import { eventDate, eventThreadIds, eventHasCalendarDate } from './timelineMetadata';
import { timelineRows } from './timelineLayout';

export interface WorldCamera { x: number; y: number; scale: number }
const MIN = .05, MAX = 2.8, GAP = 380, ROW = 160;
const date = (y: number) => y < 0 ? `${-y} BC` : `AD ${y}`;

/** A camera over a spacious, deterministic world; zoom never rearranges events. */
export class TimelineWorld {
  camera: WorldCamera = { x: 20, y: 12, scale: 1 };
  private world: HTMLElement;
  private viewport: HTMLElement;
  private zoomLabel: HTMLElement;
  private width: number;
  private height: number;
  private points = new Map<number, { x: number; y: number }>();
  private gesture: { x: number; y: number; distance: number } | null = null;
  private moved = false;
  private observer: ResizeObserver;
  private years: number[];
  private rowPositions: number[];
  private rowEvents: TimelineEvent[];
  private columnNodes: { event: TimelineEvent; card: HTMLElement; x: number; y: number }[][] = [];
  private destroyed = false;
  private paths: { el: SVGElement; a: string; b: string }[] = [];
  private nodes: { el: SVGElement; id: string }[] = [];
  private eventNodes = new Map<string, { event: TimelineEvent; card: HTMLElement; x: number; y: number }>();
  private relations = new Map<string, Map<string, string[]>>();
  private positionLabel: HTMLElement;
  private columnPicker: HTMLSelectElement;
  private columnLabels: string[] = [];
  private selected: string | null = null;
  private hitAreas: SVGGeometryElement[] = [];
  private svg: SVGSVGElement;
  private cards: { el: HTMLElement; x: number; y: number }[] = [];
  private headings: { el: HTMLElement; x: number }[] = [];
  private rails: { el: HTMLElement; x: number }[] = [];
  private frame: number | null = null;

  constructor(private host: HTMLElement, events: TimelineEvent[], data: TimelineData,
    focuses: Subject[], private openEvent: (event: TimelineEvent, node: HTMLElement) => void, saved?: WorldCamera,
    narrative: readonly (readonly [string, string])[] = [],
    onInterval?: (a: TimelineEvent, b: TimelineEvent, context: string) => void) {
    host.addClass('sg-tw-host');
    const controls = host.createDiv({ cls: 'sg-tw-tools', attr: { 'aria-label': 'Canvas controls' } });
    const button = (text: string, label: string, action: () => void) => {
      controls.createEl('button', { text, attr: { 'aria-label': label, title: label } }).onclick = action;
    };
    button('−', 'Zoom out', () => this.zoomBy(1 / 1.25));
    this.zoomLabel = controls.createSpan({ cls: 'sg-tw-percent' });
    button('+', 'Zoom in', () => this.zoomBy(1.25));
    button('Fit width', 'Fit all timeline columns', () => this.fitWidth());
    button('Start', 'Return to the first event', () => { this.camera = { x: 20, y: 12, scale: 1 }; this.paint(); });
    const compass = host.createDiv({ cls: 'sg-tw-compass' });
    this.columnPicker = compass.createEl('select', { attr: { 'aria-label': 'Go to a storyline' } });
    this.columnPicker.onchange = () => {
      const index = Number(this.columnPicker.value);
      const target = -this.camera.y / this.camera.scale + 125;
      const candidates = this.columnNodes[index];
      const node = candidates?.length ? candidates.reduce((best, n) => Math.abs(n.y - target) < Math.abs(best.y - target) ? n : best) : undefined;
      this.camera.x = 20 - index * GAP * this.camera.scale;
      if (node) this.camera.y = 150 - node.y * this.camera.scale;
      this.paint();
    };
    this.positionLabel = compass.createDiv({ cls: 'sg-tw-position', attr: { 'aria-live': 'off' } });
    this.viewport = host.createDiv({ cls: 'sg-tw-viewport', attr: { tabindex: '0', role: 'region', 'aria-label': 'Timeline canvas. Drag to pan, pinch to zoom. Arrow keys pan; plus and minus zoom.' } });
    this.world = this.viewport.createDiv({ cls: 'sg-tw-world' });
    host.createDiv({ cls: 'sg-tw-hint', text: 'Drag in any direction · Pinch to zoom · Tap an event to read' });
    if (!events.length) {
      this.viewport.createDiv({ cls: 'sg-tl-empty', text: 'No events match. Adjust your filters to explore.' });
    }
    const laneNames: Record<string, string> = { ow: 'Bible', nw: 'Book of Mormon', rs: 'Restoration' };
    const color: Record<string, string> = { ow: '#e4b857', nw: '#71cfb2', rs: '#c5a5eb' };
    const threads = new Map((data.threads ?? []).map(t => [t.id, t]));
    const columns: { key: string; label: string; color: string; matches: (e: TimelineEvent) => boolean }[] = [];
    if (focuses.length) {
      focuses.forEach((s, i) => columns.push({ key: `${s.kind}:${s.name}`, label: s.name,
        color: ['#e4b857', '#71cfb2', '#c5a5eb', '#85bbed'][i % 4]!, matches: e => (e[s.kind] ?? []).includes(s.name) }));
    } else {
      for (const lane of ['ow', 'nw', 'rs']) {
        const keys = [...new Set(events.flatMap(e => {
          const ids = eventThreadIds(e);
          return ids.length ? ids.filter(id => (threads.get(id)?.lane ?? e.lane) === lane) : e.lane === lane ? [lane] : [];
        }))];
        for (const key of keys) columns.push({ key, label: threads.get(key)?.label ?? laneNames[lane]!, color: threads.get(key)?.group === 'Records' ? '#ddc18b' : color[lane]!,
          matches: e => eventThreadIds(e).length ? eventThreadIds(e).includes(key) : e.lane === key });
      }
    }
    this.columnLabels = columns.map(c => c.label);
    columns.forEach((col, i) => {
      this.columnNodes.push([]);
      this.columnPicker.createEl('option', { text: `${col.label} · ${events.filter(col.matches).length}`, attr: { value: String(i) } });
    });
    const memberships = events.map(event => columns.map((c, i) => c.matches(event) ? i : -1).filter(i => i >= 0));
    this.rowPositions = timelineRows(events, memberships);
    this.rowEvents = events;
    this.width = Math.max(GAP, columns.length * GAP + 40);
    this.height = Math.max(600, (Math.max(-1, ...this.rowPositions) + 1) * ROW + 220);
    this.years = events.map(e => e.y0);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg = svg;
    svg.classList.add('sg-tw-lines'); this.world.append(svg);
    const positions = new Map<string, { x: number; y: number }>();
    const lastInColumn = new Map<number, { id: string; x: number; y: number }>();
    const path = (a: string, b: string, d: string, cls: string, color?: string, label?: string) => {
      const el = document.createElementNS(svg.namespaceURI, 'path') as SVGElement;
      el.setAttribute('d', d); el.setAttribute('class', `sg-tw-path ${cls}`);
      el.setAttribute('data-a', a); el.setAttribute('data-b', b);
      if (color) el.style.stroke = color;
      if (label) { const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = label; el.append(title); }
      svg.append(el); this.paths.push({ el, a, b });
    };
    columns.forEach((col, index) => {
      const rail = this.world.createDiv({ cls: 'sg-tw-rail' });
      rail.style.background = col.color;
      this.rails.push({ el: rail, x: index * GAP + 56 });
      const heading = this.world.createDiv({ cls: 'sg-tw-column', text: col.label });
      heading.style.color = col.color;
      this.headings.push({ el: heading, x: index * GAP + 78 });
    });
    events.forEach((event, eventIndex) => {
      const row = this.rowPositions[eventIndex]!;
      const indexes = memberships[eventIndex]!;
      if (indexes.length > 1) {
        const line = document.createElementNS(svg.namespaceURI, 'line');
        line.setAttribute('x1', String(indexes[0]! * GAP + 56)); line.setAttribute('x2', String(indexes[indexes.length - 1]! * GAP + 56));
        line.setAttribute('y1', String(row * ROW + 125)); line.setAttribute('y2', String(row * ROW + 125)); svg.append(line);
        this.paths.push({ el: line as SVGElement, a: event.id, b: event.id });
      }
      for (const index of indexes) {
        const x = index * GAP + 56, y = row * ROW + 125;
        if (!positions.has(event.id)) positions.set(event.id, { x, y });
        const previous = lastInColumn.get(index);
        if (previous) {
          path(previous.id, event.id, `M ${x} ${previous.y} C ${x - 10} ${previous.y + 45}, ${x + 10} ${y - 45}, ${x} ${y}`, 'sg-tw-chain', columns[index]!.color, columns[index]!.label);
          this.addRelation(previous.id, event.id, `Next in ${columns[index]!.label}`);
          this.addRelation(event.id, previous.id, `Earlier in ${columns[index]!.label}`);
        }
        lastInColumn.set(index, { id: event.id, x, y });
        path(event.id, event.id, `M ${x} ${y} L ${x + 22} ${y}`, 'sg-tw-chain', columns[index]!.color);
        const node = document.createElementNS(svg.namespaceURI, 'circle') as SVGElement;
        node.setAttribute('cx', String(x)); node.setAttribute('cy', String(y)); node.setAttribute('r', '7');
        node.setAttribute('class', 'sg-tw-node'); node.style.fill = columns[index]!.color;
        svg.append(node); this.nodes.push({ el: node, id: event.id });
        const card = this.world.createEl('button', { cls: 'sg-tw-event', attr: { 'aria-label': `${event.t}, ${eventDate(event)}. Read event` } });
        this.cards.push({ el: card, x: index * GAP + 78, y: row * ROW + 86 });
        card.style.borderLeftColor = columns[index]!.color;
        card.style.setProperty('--tw-lane', columns[index]!.color);
        card.setAttribute('data-event-id', event.id);
        this.columnNodes[index]!.push({ event, card, x, y });
        if (!this.eventNodes.has(event.id)) this.eventNodes.set(event.id, { event, card, x, y });
        const qualifier = !eventHasCalendarDate(event) ? 'Scripture sequence' : event.dating === 'traditional' ? 'Traditional dating' : event.dating === 'approximate' ? 'Approximate' : event.dating === 'internal' ? 'Scriptural chronology' : event.dating;
        card.createSpan({ cls: 'sg-tw-date', text: eventDate(event) });
        card.createSpan({ cls: 'sg-tw-title', text: event.t });
        card.createSpan({ cls: 'sg-tw-read', text: `${qualifier} · Explore ›` });
        card.onclick = eventClick => { if (!this.moved || eventClick.detail === 0) this.openEvent(event, card); };
      }
    });
    for (const edge of timelineConnections(events, data, narrative)) {
      const a = positions.get(edge.a), b = positions.get(edge.b); if (!a || !b) continue;
      for (const label of edge.labels) { this.addRelation(edge.a, edge.b, label); this.addRelation(edge.b, edge.a, label); }
      const bend = Math.min(44, Math.max(26, Math.abs(b.y - a.y) * .1));
      const d = a.x === b.x
        ? `M ${a.x} ${a.y} C ${a.x - bend} ${a.y + 24}, ${b.x - bend} ${b.y - 24}, ${b.x} ${b.y}`
        : `M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`;
      path(edge.a, edge.b, d, `sg-tw-web sg-tw-${edge.kind}`, undefined, edge.labels.join(' · '));
    }
    // Keep the event dots above the restored paths.
    for (const node of this.nodes) svg.append(node.el);
    // Invisible twins provide a 28-screen-pixel target even at overview zoom.
    // Keep them under the HTML cards and let pointer events bubble for panning.
    if (onInterval) for (const edge of this.paths) {
      if (edge.a === edge.b && edge.el.tagName.toLowerCase() !== 'line') continue;
      const a = this.eventNodes.get(edge.a)?.event, b = this.eventNodes.get(edge.b)?.event;
      if (!a || !b) continue;
      const hit = edge.el.cloneNode(false) as SVGGeometryElement;
      hit.removeAttribute('style'); hit.setAttribute('class', 'sg-tw-hit');
      hit.setAttribute('tabindex', '0'); hit.setAttribute('role', 'button');
      hit.setAttribute('aria-label', `Time between ${a.t} and ${b.t}`);
      const activate = () => {
        onInterval(a, b, edge.el.querySelector('title')?.textContent ?? (a.id === b.id ? 'Shared event' : 'Timeline connection'));
        edge.el.classList.add('is-interval');
      };
      hit.addEventListener('click', e => { e.stopPropagation(); if (!this.moved || (e as MouseEvent).detail === 0) activate(); });
      hit.addEventListener('keydown', e => {
        const key = (e as KeyboardEvent).key;
        if (key === 'Enter' || key === ' ') { e.preventDefault(); e.stopPropagation(); activate(); }
      });
      svg.append(hit); this.hitAreas.push(hit);
    }
    if (saved && [saved.x, saved.y, saved.scale].every(Number.isFinite)) this.camera = { ...saved, scale: Math.max(MIN, Math.min(MAX, saved.scale)) };
    this.viewport.addEventListener('pointerdown', this.down);
    this.viewport.addEventListener('pointermove', this.move);
    this.viewport.addEventListener('pointerup', this.up);
    this.viewport.addEventListener('pointercancel', this.cancel);
    this.viewport.addEventListener('lostpointercapture', this.cancel);
    this.viewport.addEventListener('wheel', this.wheel, { passive: false });
    this.viewport.addEventListener('keydown', this.key);
    this.observer = new ResizeObserver(() => this.paint()); this.observer.observe(this.viewport);
    this.paint();
  }
  select(id: string | null): void {
    for (const p of this.paths) p.el.classList.remove('is-interval');
    this.selected = id;
    this.world.classList.toggle('has-selection', id !== null);
    const related = new Set(this.relations.get(id ?? '')?.keys() ?? []);
    this.world.querySelectorAll<HTMLElement>('.sg-tw-event').forEach(card => {
      const key = card.dataset.eventId!;
      card.classList.toggle('is-selected', key === id);
      card.classList.toggle('is-related', related.has(key));
    });
    for (const p of this.paths) p.el.classList.toggle('is-active', id !== null && (p.a === id || p.b === id));
    for (const n of this.nodes) n.el.classList.toggle('is-active', n.id === id);
    this.paint();
  }
  private addRelation(a: string, b: string, label: string): void {
    const peers = this.relations.get(a) ?? new Map<string, string[]>();
    const labels = peers.get(b) ?? []; if (!labels.includes(label)) labels.push(label);
    peers.set(b, labels); this.relations.set(a, peers);
  }
  connections(id: string): { id: string; title: string; reason: string }[] {
    return [...(this.relations.get(id) ?? [])].flatMap(([peer, labels]) => {
      const event = this.eventNodes.get(peer)?.event;
      return event ? [{ id: peer, title: event.t, reason: labels.join(' · ') }] : [];
    });
  }
  follow(id: string): void {
    const node = this.columnNodes[Number(this.columnPicker.value)]?.find(n => n.event.id === id) ?? this.eventNodes.get(id); if (!node) return;
    this.camera.scale = Math.max(.8, this.camera.scale);
    this.camera.x = 34 - node.x * this.camera.scale;
    this.camera.y = 120 - node.y * this.camera.scale;
    this.paint(); this.openEvent(node.event, node.card);
  }
  private middle() {
    const p = [...this.points.values()]; if (!p.length) return null;
    if (p.length === 1) return { ...p[0]!, distance: 0 };
    return { x: (p[0]!.x + p[1]!.x) / 2, y: (p[0]!.y + p[1]!.y) / 2, distance: Math.hypot(p[1]!.x - p[0]!.x, p[1]!.y - p[0]!.y) };
  }
  private down = (e: PointerEvent) => {
    if (e.button !== 0 || this.points.size >= 2) return;
    if (!this.points.size) this.moved = false;
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.gesture = this.middle();
    // Capture on the original button so an unmoved tap still activates it.
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  private move = (e: PointerEvent) => {
    if (!this.points.has(e.pointerId) || !this.gesture) return;
    this.points.set(e.pointerId, { x: e.clientX, y: e.clientY }); const next = this.middle()!, prev = this.gesture;
    const dx = next.x - prev.x, dy = next.y - prev.y;
    if (!this.moved && Math.hypot(dx, dy) < 4 && next.distance === prev.distance) return;
    this.moved = true;
    const box = this.viewport.getBoundingClientRect(), oldScale = this.camera.scale;
    const scale = next.distance && prev.distance ? Math.max(MIN, Math.min(MAX, oldScale * next.distance / prev.distance)) : oldScale;
    this.camera.x = next.x - box.left - (prev.x - box.left - this.camera.x) * scale / oldScale;
    this.camera.y = next.y - box.top - (prev.y - box.top - this.camera.y) * scale / oldScale;
    this.camera.scale = scale; this.gesture = next; this.requestPaint();
  };
  private up = (e: PointerEvent) => { this.points.delete(e.pointerId); this.gesture = this.middle(); };
  private cancel = (e: PointerEvent) => { if (this.points.has(e.pointerId)) { this.moved = true; this.up(e); } };
  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const b = this.viewport.getBoundingClientRect(); this.scaleBy(Math.exp(-e.deltaY * .008), e.clientX - b.left, e.clientY - b.top); }
    else { this.camera.x -= e.shiftKey ? e.deltaY : e.deltaX; this.camera.y -= e.shiftKey ? 0 : e.deltaY; }
    this.requestPaint();
  };
  private key = (e: KeyboardEvent) => {
    const shifts: Record<string, [number, number]> = { ArrowLeft: [90, 0], ArrowRight: [-90, 0], ArrowUp: [0, 90], ArrowDown: [0, -90] };
    if (shifts[e.key]) { e.preventDefault(); this.camera.x += shifts[e.key]![0]; this.camera.y += shifts[e.key]![1]; this.paint(); }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); this.zoomBy(1.25); }
    else if (e.key === '-') { e.preventDefault(); this.zoomBy(1 / 1.25); }
  };
  zoomBy(factor: number, x = this.viewport.clientWidth / 2, y = this.viewport.clientHeight / 2): void {
    this.scaleBy(factor, x, y); this.paint();
  }
  private scaleBy(factor: number, x: number, y: number): void {
    const old = this.camera.scale, scale = Math.max(MIN, Math.min(MAX, old * factor));
    this.camera = { x: x - (x - this.camera.x) * scale / old, y: y - (y - this.camera.y) * scale / old, scale };
  }
  fitWidth(): void { this.camera.scale = Math.max(MIN, Math.min(1, (this.viewport.clientWidth - 24) / this.width)); this.camera.x = 12; this.paint(); }
  ensureReadable(): void {
    if (this.camera.scale >= .6) return;
    const year = this.year, column = Number(this.columnPicker.value) || 0;
    this.camera = { x: 20 - column * GAP, y: 12, scale: 1 };
    if (year !== null) this.jump(year); else this.paint();
  }
  jump(year: number): void {
    let index = this.years.findIndex(y => y >= year); if (index < 0) index = Math.max(0, this.years.length - 1);
    this.camera.y = 60 - (110 + (this.rowPositions[index] ?? 0) * ROW) * this.camera.scale; this.paint();
  }
  private get topEvent(): TimelineEvent | undefined {
    const row = (-this.camera.y / this.camera.scale - 110) / ROW;
    let best = 0;
    for (let i = 1; i < this.rowPositions.length; i++) if (Math.abs(this.rowPositions[i]! - row) < Math.abs(this.rowPositions[best]! - row)) best = i;
    return this.rowEvents[best];
  }
  get year(): number | null { return this.topEvent?.y0 ?? null; }
  private requestPaint(): void {
    if (this.destroyed || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => { this.frame = null; this.paint(); });
  }
  private paint(): void {
    if (this.destroyed) return;
    if (this.frame !== null) { cancelAnimationFrame(this.frame); this.frame = null; }
    const width = this.viewport.clientWidth, height = this.viewport.clientHeight;
    this.camera.x = Math.min(60, Math.max(Math.min(20, width - this.width * this.camera.scale - 40), this.camera.x));
    this.camera.y = Math.min(60, Math.max(Math.min(12, height - this.height * this.camera.scale - 40), this.camera.y));
    const { x, y, scale } = this.camera;
    // Keep the backing surface screen-sized. Scaling a world-sized HTML/SVG
    // layer can exhaust a mobile WebView even when it looks small on screen.
    this.svg.setAttribute('width', String(width)); this.svg.setAttribute('height', String(height));
    if (width && height) this.svg.setAttribute('viewBox', `${-x / scale} ${-y / scale} ${width / scale} ${height / scale}`);
    const place = (el: HTMLElement, left: number, top: number, w: number, h: number) => {
      const sx = x + left * scale, sy = y + top * scale;
      // Small overscan preserves shadows and prevents cards popping at an edge.
      const visible = sx + w * scale >= -40 && sx <= width + 40 && sy + h * scale >= -40 && sy <= height + 40;
      el.style.display = visible ? '' : 'none';
      if (visible) el.style.transform = `translate(${sx}px, ${sy}px) scale(${scale})`;
    };
    for (const card of this.cards) place(card.el, card.x, card.y, 280, 155);
    for (const heading of this.headings) place(heading.el, heading.x, 18, 280, 80);
    for (const rail of this.rails) {
      const left = x + rail.x * scale, top = Math.max(0, y + 65 * scale);
      const bottom = Math.min(height, y + (this.height - 15) * scale);
      rail.el.style.display = left >= 0 && left <= width && bottom > top ? '' : 'none';
      rail.el.style.left = `${left}px`; rail.el.style.top = `${top}px`;
      rail.el.style.width = `${2 * scale}px`; rail.el.style.height = `${Math.max(0, bottom - top)}px`;
    }
    this.zoomLabel.textContent = `${Math.round(this.camera.scale * 100)}%`;
    for (const hit of this.hitAreas) hit.style.strokeWidth = `${28 / this.camera.scale}px`;
    this.world.classList.toggle('is-overview', this.camera.scale < .55);
    const column = Math.max(0, Math.min(this.columnLabels.length - 1, Math.round(-this.camera.x / (GAP * this.camera.scale))));
    this.columnPicker.value = String(column);
    const top = this.topEvent;
    this.positionLabel.textContent = top ? `${eventHasCalendarDate(top) ? date(top.y0) : 'Date not specified'} · ${this.selected ? 'Following connections' : 'Drag to explore'}` : 'Drag to explore';
  }
  destroy(): void {
    this.destroyed = true; this.observer.disconnect(); this.points.clear();
    if (this.frame !== null) { cancelAnimationFrame(this.frame); this.frame = null; }
    this.viewport.removeEventListener('pointerdown', this.down); this.viewport.removeEventListener('pointermove', this.move);
    this.viewport.removeEventListener('pointerup', this.up); this.viewport.removeEventListener('pointercancel', this.cancel);
    this.viewport.removeEventListener('lostpointercapture', this.cancel); this.viewport.removeEventListener('wheel', this.wheel); this.viewport.removeEventListener('keydown', this.key);
    this.host.removeClass('sg-tw-host');
  }
}
