import { AfterViewInit, Component, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon, IonSpinner, NavController } from '@ionic/angular';
import { Api } from '../../core/api.service';
import { GeoService, Place } from '../../core/geo.service';
import { Ui } from '../../core/ui.service';
import { MapComponent } from '../../shared/map.component';
import { cop, errMsg } from '../../config';

@Component({
  selector: 'app-request',
  standalone: true,
  imports: [FormsModule, IonIcon, IonSpinner, MapComponent],
  template: `
  <div class="stage">
    <app-map #map (picked)="onPick($event)"></app-map>
    <button class="float-btn" aria-label="Volver" (click)="nav.navigateBack('/client/home')"><ion-icon name="arrow-back"></ion-icon></button>

    <div class="panel">
      @if (step() === 'search') {
        <h2 class="h2">¿A dónde vas?</h2>
        <div class="route">
          <div class="row"><span class="dot"></span>
            <div class="grow"><div class="ell">{{ origin()?.name || 'Buscando tu ubicación…' }}</div><div class="muted" style="font-size:13px">Punto de recogida</div></div>
          </div>
          <div class="row"><span class="sq"></span>
            <input class="field" name="q" [ngModel]="query" (ngModelChange)="onType($event)" placeholder="Buscar destino" autocomplete="off" aria-label="Destino">
          </div>
        </div>
        @if (searching()) { <div class="center"><ion-spinner name="dots"></ion-spinner></div> }
        @for (p of results(); track $index) {
          <button class="place" (click)="setDest(p)"><ion-icon name="location"></ion-icon><span>{{ p.name }}</span></button>
        }
        <p class="muted hint">También puedes tocar el mapa para marcar el destino.</p>
      } @else {
        <div class="route" style="margin-top:0">
          <div class="row"><span class="dot"></span><span class="grow ell">{{ origin()?.name }}</span></div>
          <div class="row"><span class="sq"></span><span class="grow ell">{{ dest()?.name }}</span>
            <button class="link" (click)="changeDest()">Cambiar</button></div>
        </div>
        @if (loadingEst()) {
          <div class="center"><ion-spinner name="dots"></ion-spinner><span class="muted">Calculando tarifa…</span></div>
        } @else if (est(); as e) {
          <div class="option">
            <ion-icon name="car-sport"></ion-icon>
            <div class="grow"><b>UberX</b><div class="muted" style="font-size:14px">{{ e.duration_min }} min · {{ e.distance_km }} km</div></div>
            <b>{{ cop(e.estimated_fare) }}</b>
          </div>
          @if (e.fare_breakdown?.surge_multiplier > 1) {
            <p><span class="chip red">Alta demanda: precio x{{ e.fare_breakdown.surge_multiplier }}</span></p>
          }
          <button class="btn mt" [disabled]="busy()" (click)="confirm()">{{ busy() ? 'Solicitando…' : 'Confirmar UberX' }}</button>
        }
      }
    </div>
  </div>`,
})
export class RequestPage implements AfterViewInit {
  @ViewChild('map') map!: MapComponent;
  private api = inject(Api);
  private geo = inject(GeoService);
  private ui = inject(Ui);
  nav = inject(NavController);
  cop = cop;

  step = signal<'search' | 'confirm'>('search');
  origin = signal<Place | null>(null);
  dest = signal<Place | null>(null);
  results = signal<Place[]>([]);
  searching = signal(false);
  loadingEst = signal(false);
  busy = signal(false);
  est = signal<any>(null);
  query = '';
  private timer?: ReturnType<typeof setTimeout>;

  async ngAfterViewInit() {
    const pos = await this.geo.position();
    this.map.center(pos.lat, pos.lng, 16);
    this.map.setMarker('origin', 'origin', pos.lat, pos.lng);
    this.origin.set({ name: 'Tu ubicación', lat: pos.lat, lng: pos.lng });
    if (!pos.real) this.ui.toast('No pudimos obtener tu ubicación; usamos una de ejemplo.');
    const name = await this.geo.reverse(pos.lat, pos.lng);
    this.origin.update(o => (o ? { ...o, name } : o));
  }

  onType(q: string) {
    this.query = q;
    clearTimeout(this.timer);
    if (q.trim().length < 3) { this.results.set([]); return; }
    this.timer = setTimeout(async () => {
      this.searching.set(true);
      try { this.results.set(await this.geo.search(q, this.origin() ?? undefined)); }
      catch { this.results.set([]); }
      finally { this.searching.set(false); }
    }, 450);
  }

  async onPick(c: { lat: number; lng: number }) {
    this.map.setMarker('dest', 'dest', c.lat, c.lng);
    const name = await this.geo.reverse(c.lat, c.lng);
    await this.setDest({ name, lat: c.lat, lng: c.lng });
  }

  async setDest(p: Place) {
    const o = this.origin();
    if (!o) { this.ui.toast('Espera a que encontremos tu ubicación.'); return; }
    this.dest.set(p);
    this.query = p.name;
    this.results.set([]);
    this.est.set(null);
    this.step.set('confirm');
    this.loadingEst.set(true);
    this.map.setMarker('dest', 'dest', p.lat, p.lng);

    const [est, route] = await Promise.all([
      this.api.post('/client/estimate-fare', {
        origin_latitude: o.lat, origin_longitude: o.lng,
        destination_latitude: p.lat, destination_longitude: p.lng,
      }).catch(e => { this.ui.toast(errMsg(e)); return null; }),
      this.geo.route(o, p),
    ]);
    this.loadingEst.set(false);
    this.map.drawRoute(route);
    this.map.fit(route, 320);
    if (est) this.est.set(est.estimate); else this.changeDest();
  }

  changeDest() {
    this.step.set('search');
    this.est.set(null);
    this.dest.set(null);
    this.map.removeMarker('dest');
  }

  async confirm() {
    const o = this.origin(), d = this.dest();
    if (!o || !d) return;
    this.busy.set(true);
    try {
      const r = await this.api.post('/client/ride-requests', {
        origin_name: o.name, origin_latitude: o.lat, origin_longitude: o.lng,
        destination_name: d.name, destination_latitude: d.lat, destination_longitude: d.lng,
      });
      localStorage.setItem('lastRide', JSON.stringify(r.ride_request));
      this.nav.navigateRoot('/ride/trip');
    } catch (e: any) {
      if (e.status === 400 && e.error?.active_request_id) {
        this.ui.toast(e.error.message);
        this.nav.navigateRoot('/ride/trip');
      } else {
        this.ui.toast(errMsg(e));
      }
    } finally {
      this.busy.set(false);
    }
  }
}
