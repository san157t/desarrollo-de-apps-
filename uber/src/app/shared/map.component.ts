import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild, signal } from '@angular/core';
import * as L from 'leaflet';
import { DEFAULT_CENTER } from '../config';

export type MarkerKind = 'origin' | 'dest' | 'car';

const CAR = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v-2H7v2H5v-6zm3-.5h8l-.9-3H8.9l-.9 3zM7.5 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>`;

/** Proveedores de mosaicos. Si el primero no carga, se prueba el siguiente. */
const TILES = [
  { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', subdomains: 'abcd', attr: '&copy; OpenStreetMap &copy; CARTO' },
  { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', subdomains: 'abc', attr: '&copy; OpenStreetMap' },
];

@Component({
  selector: 'app-map',
  standalone: true,
  template: `
    <div #el class="map"></div>
    @if (offline()) {
      <div class="map-offline" role="status">
        <b>No se pudo cargar el mapa</b>
        <span>Revisa que el dispositivo tenga internet. Los marcadores y la ruta se siguen mostrando.</span>
      </div>
    }`,
  styles: [`
    :host { display: block; position: absolute; inset: 0; background: #e9edf1; }
    .map { position: absolute; inset: 0; background: #e9edf1; }
    .map-offline { position: absolute; z-index: 500; left: 16px; right: 16px; top: calc(env(safe-area-inset-top, 0px) + 68px);
      display: grid; gap: 2px; padding: 10px 14px; border-radius: 12px; background: #fff; font-size: 13px; line-height: 1.35;
      box-shadow: 0 4px 16px rgba(0,0,0,.18); color: #333; }
    .map-offline b { font-size: 14px; color: #000; }
  `],
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('el', { static: true }) el!: ElementRef<HTMLDivElement>;
  @Output() picked = new EventEmitter<{ lat: number; lng: number }>();

  offline = signal(false);

  private map?: L.Map;
  private base?: L.TileLayer;
  private provider = 0;
  private loaded = 0;
  private failed = 0;
  private markers = new Map<string, L.Marker>();
  private route?: L.LayerGroup;
  private ro?: ResizeObserver;
  private timers: ReturnType<typeof setTimeout>[] = [];

  ngOnInit() {
    this.map = L.map(this.el.nativeElement, { zoomControl: false, attributionControl: true })
      .setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 15);
    this.map.attributionControl.setPrefix(false);
    this.useProvider(0);
    this.map.on('click', (e: L.LeafletMouseEvent) => this.picked.emit({ lat: e.latlng.lat, lng: e.latlng.lng }));

    // El mapa nace mientras la página aún hace su animación de entrada (tamaño 0):
    // se recalcula el tamaño varias veces para que los mosaicos se pidan y se pinten.
    this.ro = new ResizeObserver(() => this.invalidate());
    this.ro.observe(this.el.nativeElement);
    [0, 150, 400, 900].forEach(ms => this.timers.push(setTimeout(() => this.invalidate(), ms)));
  }

  invalidate() { this.map?.invalidateSize({ animate: false }); }

  private useProvider(i: number) {
    if (!this.map) return;
    this.base?.remove();
    this.provider = i;
    this.loaded = 0;
    this.failed = 0;
    const t = TILES[i];
    this.base = L.tileLayer(t.url, { subdomains: t.subdomains, maxZoom: 19, attribution: t.attr });
    this.base.on('tileload', () => { this.loaded++; if (this.offline()) this.offline.set(false); });
    this.base.on('tileerror', () => {
      this.failed++;
      if (this.loaded > 0 || this.failed < 4) return;
      if (this.provider < TILES.length - 1) this.useProvider(this.provider + 1);
      else this.offline.set(true);
    });
    this.base.addTo(this.map);
  }

  setMarker(key: string, kind: MarkerKind, lat: number, lng: number) {
    if (!this.map || !isFinite(lat) || !isFinite(lng)) return;
    const m = this.markers.get(key);
    if (m) { m.setLatLng([lat, lng]); return; }
    const car = kind === 'car';
    const icon = L.divIcon({
      className: 'mk',
      html: car ? `<div class="mk-car">${CAR}</div>` : `<div class="mk-${kind}"></div>`,
      iconSize: car ? [38, 38] : [22, 22],
      iconAnchor: car ? [19, 19] : [11, 11],
    });
    this.markers.set(key, L.marker([lat, lng], { icon, interactive: false, keyboard: false }).addTo(this.map));
  }

  removeMarker(key: string) {
    this.markers.get(key)?.remove();
    this.markers.delete(key);
  }

  drawRoute(coords: [number, number][]) {
    if (!this.map) return;
    this.route?.remove();
    this.route = L.layerGroup([
      L.polyline(coords, { color: '#fff', weight: 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round', interactive: false }),
      L.polyline(coords, { color: '#000', weight: 5, lineCap: 'round', lineJoin: 'round', interactive: false }),
    ]).addTo(this.map);
  }

  center(lat: number, lng: number, zoom = 16) {
    this.map?.setView([lat, lng], zoom);
  }

  fit(points: [number, number][], bottom = 300) {
    if (!this.map) return;
    const pts = points.filter(p => isFinite(p[0]) && isFinite(p[1]));
    if (!pts.length) return;
    if (pts.length === 1) { this.map.setView(pts[0], 16); return; }
    this.map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [40, 90], paddingBottomRight: [40, bottom] });
  }

  ngOnDestroy() {
    this.timers.forEach(clearTimeout);
    this.ro?.disconnect();
    this.map?.remove();
  }
}
