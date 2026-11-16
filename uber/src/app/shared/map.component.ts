import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import * as L from 'leaflet';
import { DEFAULT_CENTER } from '../config';

export type MarkerKind = 'origin' | 'dest' | 'car';

const CAR = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#fff" d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11v6h-2v-2H7v2H5v-6zm3-.5h8l-.9-3H8.9l-.9 3zM7.5 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>`;

@Component({
  selector: 'app-map',
  standalone: true,
  template: `<div #el class="map"></div>`,
  styles: [`.map { width: 100%; height: 100%; }`],
})
export class MapComponent implements OnInit, OnDestroy {
  @ViewChild('el', { static: true }) el!: ElementRef<HTMLDivElement>;
  @Output() picked = new EventEmitter<{ lat: number; lng: number }>();

  private map?: L.Map;
  private markers = new Map<string, L.Marker>();
  private line?: L.Polyline;
  private ro?: ResizeObserver;

  ngOnInit() {
    this.map = L.map(this.el.nativeElement, { zoomControl: false }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 15);
    // Mapa gratuito de OpenStreetMap: no requiere cuenta ni clave.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);
    this.map.on('click', (e: L.LeafletMouseEvent) => this.picked.emit({ lat: e.latlng.lat, lng: e.latlng.lng }));
    this.ro = new ResizeObserver(() => this.map?.invalidateSize());
    this.ro.observe(this.el.nativeElement);
  }

  setMarker(key: string, kind: MarkerKind, lat: number, lng: number) {
    if (!this.map || !isFinite(lat) || !isFinite(lng)) return;
    const m = this.markers.get(key);
    if (m) { m.setLatLng([lat, lng]); return; }
    const car = kind === 'car';
    const icon = L.divIcon({
      className: 'mk',
      html: car ? `<div class="mk-car">${CAR}</div>` : `<div class="mk-${kind}"></div>`,
      iconSize: car ? [36, 36] : [20, 20],
      iconAnchor: car ? [18, 18] : [10, 10],
    });
    this.markers.set(key, L.marker([lat, lng], { icon, interactive: false }).addTo(this.map));
  }

  removeMarker(key: string) {
    this.markers.get(key)?.remove();
    this.markers.delete(key);
  }

  drawRoute(coords: [number, number][]) {
    if (!this.map) return;
    this.line?.remove();
    this.line = L.polyline(coords, { color: '#000', weight: 4 }).addTo(this.map);
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
    this.ro?.disconnect();
    this.map?.remove();
  }
}
