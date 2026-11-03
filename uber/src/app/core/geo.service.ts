import { Injectable } from '@angular/core';
import { DEFAULT_CENTER } from '../config';

export interface LatLng { lat: number; lng: number; }
export interface Place extends LatLng { name: string; }

@Injectable({ providedIn: 'root' })
export class GeoService {
  position(): Promise<LatLng & { real: boolean }> {
    return new Promise(res => {
      if (!navigator.geolocation) return res({ ...DEFAULT_CENTER, real: false });
      navigator.geolocation.getCurrentPosition(
        p => res({ lat: p.coords.latitude, lng: p.coords.longitude, real: true }),
        () => res({ ...DEFAULT_CENTER, real: false }),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
      );
    });
  }

  /** Búsqueda de direcciones con Nominatim (OpenStreetMap). */
  async search(q: string, near?: LatLng): Promise<Place[]> {
    const p = new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': 'es' });
    if (near) p.set('viewbox', [near.lng - 0.3, near.lat + 0.3, near.lng + 0.3, near.lat - 0.3].join(','));
    const r = await fetch(`https://nominatim.openstreetmap.org/search?${p}`);
    const j = await r.json();
    return j.map((x: any) => ({ name: this.short(x.display_name), lat: +x.lat, lng: +x.lon }));
  }

  async reverse(lat: number, lng: number): Promise<string> {
    const fallback = 'Ubicación en el mapa';
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`);
      const j = await r.json();
      return this.short(j.display_name) || fallback;
    } catch { return fallback; }
  }

  /** Ruta por calles con OSRM; si falla, línea recta. */
  async route(a: LatLng, b: LatLng): Promise<[number, number][]> {
    try {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`);
      const j = await r.json();
      return j.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]) as [number, number][];
    } catch { return [[a.lat, a.lng], [b.lat, b.lng]]; }
  }

  distanceKm(a: LatLng, b: LatLng): number {
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  }

  private short(n = ''): string { return n.split(',').slice(0, 3).join(',').trim(); }
}
