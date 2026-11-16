import { AfterViewInit, Component, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { GeoService, LatLng } from '../core/geo.service';
import { Ui } from '../core/ui.service';
import { MapComponent } from '../shared/map.component';
import { cop, errMsg, num } from '../config';

const TITLES: Record<string, string> = {
  assigned: 'Ve por el pasajero',
  driver_arrived: 'Esperando al pasajero',
  in_progress: 'Viaje en curso',
};

@Component({
  selector: 'app-driver',
  standalone: true,
  imports: [IonIcon, IonSpinner, MapComponent],
  template: `
  <div class="stage">
    <app-map #map></app-map>
    <button class="float-btn" aria-label="Cerrar sesión" (click)="logout()"><ion-icon name="log-out"></ion-icon></button>
    <button class="status-pill" [class.on]="online()" [disabled]="switching()" [attr.aria-pressed]="online()" (click)="toggle()">
      <span class="led"></span>{{ online() ? 'En línea' : 'Desconectado' }}
    </button>

    <div class="panel">
      @if (notice()) { <div class="card warn" role="alert">{{ notice() }}</div> }

      @if (summary(); as s) {
        <h2 class="h2">Viaje finalizado</h2>
        <div class="card" style="margin-top:12px">
          <div class="kv"><span>Total cobrado</span><b>{{ cop(s.fare) }}</b></div>
          <div class="kv"><span>Distancia</span><b>{{ s.km }} km</b></div>
          <div class="kv"><span>Duración</span><b>{{ s.mins }} min</b></div>
        </div>
        <button class="btn mt" (click)="summary.set(null)">Seguir recibiendo viajes</button>
      } @else if (trip(); as t) {
        <h2 class="h2">{{ titles[t.status] ?? 'Viaje' }}</h2>
        <div class="route">
          <div class="row"><span class="dot"></span><span class="grow ell">{{ t.request?.origin_name }}</span></div>
          <div class="row"><span class="sq"></span><span class="grow ell">{{ t.request?.destination_name }}</span></div>
        </div>
        <div class="kv"><span class="muted">Pasajero</span>
          <span class="row"><b>{{ t.request?.client?.name }}</b>
            @if (t.request?.client?.phone) { <a class="round" [href]="'tel:' + t.request.client.phone" aria-label="Llamar al pasajero"><ion-icon name="call"></ion-icon></a> }
          </span>
        </div>
        <div class="kv"><span class="muted">Tarifa estimada</span><b>{{ cop(t.estimated_fare ?? t.request?.estimated_fare) }}</b></div>
        @switch (t.status) {
          @case ('assigned') { <button class="btn mt" [disabled]="busy()" (click)="step('arrive')">Llegué al punto de recogida</button> }
          @case ('driver_arrived') { <button class="btn mt" [disabled]="busy()" (click)="step('start')">Iniciar viaje</button> }
          @case ('in_progress') { <button class="btn mt" [disabled]="busy()" (click)="complete()">Finalizar viaje</button> }
        }
      } @else if (online()) {
        <h2 class="h2">Solicitudes cercanas</h2>
        @if (!requests().length) {
          <div class="center"><ion-spinner name="dots"></ion-spinner><span class="muted">Esperando solicitudes…</span></div>
        }
        @for (r of requests(); track r.id) {
          <div class="req">
            <div class="route" style="margin-top:0">
              <div class="row"><span class="dot"></span><span class="grow ell">{{ r.origin_name }}</span></div>
              <div class="row"><span class="sq"></span><span class="grow ell">{{ r.destination_name }}</span></div>
            </div>
            <div class="row between"><span class="muted">{{ r.estimated_distance_km }} km · {{ r.client?.name }}</span><b>{{ cop(r.estimated_fare) }}</b></div>
            <button class="btn mt" [disabled]="accepting() === r.id" (click)="accept(r)">Aceptar viaje</button>
          </div>
        }
      } @else {
        <h2 class="h2">Estás desconectado</h2>
        <p class="muted" style="margin-top:6px">Toca “Desconectado” arriba para empezar a recibir solicitudes.</p>
      }
    </div>
  </div>`,
})
export class DriverPage implements AfterViewInit, OnDestroy {
  @ViewChild('map') map!: MapComponent;
  private api = inject(Api);
  private geo = inject(GeoService);
  private ui = inject(Ui);
  auth = inject(AuthService);
  cop = cop;
  titles = TITLES;

  online = signal(localStorage.getItem('driverOnline') === '1');
  trip = signal<any>(this.readTrip());
  requests = signal<any[]>([]);
  notice = signal('');
  switching = signal(false);
  busy = signal(false);
  accepting = signal<number | null>(null);
  summary = signal<any>(null);

  private timer?: ReturnType<typeof setInterval>;
  private watchId?: number;
  private lastSent = 0;
  private me?: LatLng;
  private travelled = 0;

  private readTrip() {
    try { return JSON.parse(localStorage.getItem('driverTrip') || 'null'); } catch { return null; }
  }

  ngAfterViewInit() { this.sync(); this.paintTrip(); }
  ionViewWillEnter() { this.sync(); }
  ionViewWillLeave() { this.stop(); }
  ngOnDestroy() { this.stop(); }

  private stop() {
    clearInterval(this.timer);
    this.timer = undefined;
    if (this.watchId !== undefined) { navigator.geolocation.clearWatch(this.watchId); this.watchId = undefined; }
  }

  private sync() {
    clearInterval(this.timer);
    this.timer = undefined;
    if (this.online() || this.trip()) this.startGps();
    if (this.online() && !this.trip()) {
      this.loadRequests();
      this.timer = setInterval(() => this.loadRequests(), 5000);
    }
  }

  private startGps() {
    if (this.watchId !== undefined || !navigator.geolocation) return;
    this.watchId = navigator.geolocation.watchPosition(p => this.onPos(p), () => { /* sin permiso de GPS */ },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 });
  }

  private onPos(p: GeolocationPosition) {
    const cur = { lat: p.coords.latitude, lng: p.coords.longitude };
    this.map?.setMarker('me', 'car', cur.lat, cur.lng);
    if (!this.me) this.map?.center(cur.lat, cur.lng, 16);
    if (this.me && this.trip()?.status === 'in_progress') {
      const km = this.geo.distanceKm(this.me, cur);
      if (km > 0.01) this.travelled += km;
    }
    this.me = cur;

    if (Date.now() - this.lastSent < 5000) return;
    this.lastSent = Date.now();
    const body: any = { latitude: cur.lat, longitude: cur.lng };
    if (p.coords.heading !== null && !isNaN(p.coords.heading)) body.heading = p.coords.heading;
    if (p.coords.speed !== null) body.speed = +(p.coords.speed * 3.6).toFixed(1);
    const t = this.trip();
    if (t) body.trip_id = t.id;
    this.api.post('/driver/location', body).catch(() => { /* se reintenta con la siguiente posición */ });
  }

  private async loadRequests() {
    try {
      const r = await this.api.get('/driver/ride-requests');
      this.requests.set(r.requests ?? []);
    } catch (e: any) {
      if (e.status === 403) { this.notice.set(e.error?.message ?? 'Tu cuenta no puede recibir solicitudes.'); this.setOnline(false); }
    }
  }

  private setOnline(v: boolean) {
    this.online.set(v);
    localStorage.setItem('driverOnline', v ? '1' : '0');
    this.sync();
  }

  private setTrip(t: any) {
    this.trip.set(t);
    if (t) localStorage.setItem('driverTrip', JSON.stringify(t)); else localStorage.removeItem('driverTrip');
    this.paintTrip();
    this.sync();
  }

  private paintTrip() {
    this.map?.removeMarker('origin');
    this.map?.removeMarker('dest');
    const q = this.trip()?.request;
    if (!q) return;
    this.map?.setMarker('origin', 'origin', num(q.origin_latitude), num(q.origin_longitude));
    this.map?.setMarker('dest', 'dest', num(q.destination_latitude), num(q.destination_longitude));
  }

  async toggle() {
    if (this.trip()) { this.ui.toast('Termina el viaje antes de desconectarte.'); return; }
    this.switching.set(true);
    try {
      const next = this.online() ? 'unavailable' : 'available';
      await this.api.put('/driver/availability', { status: next });
      this.notice.set('');
      this.setOnline(next === 'available');
    } catch (e: any) {
      const st = e.error?.approval_status;
      if (e.status === 403 && st) {
        this.notice.set(st === 'pending'
          ? 'Tu cuenta sigue en revisión. Un administrador debe aprobarla antes de que puedas conectarte.'
          : (e.error?.message ?? 'Tu cuenta no está habilitada para conducir.'));
      } else {
        this.ui.toast(errMsg(e));
      }
    } finally {
      this.switching.set(false);
    }
  }

  async accept(r: any) {
    this.accepting.set(r.id);
    try {
      const res = await this.api.post(`/driver/ride-requests/${r.id}/accept`);
      this.ui.toast('Servicio aceptado');
      this.setTrip({ ...res.trip, request: r });
    } catch (e) {
      this.ui.toast(errMsg(e));
      this.loadRequests();
    } finally {
      this.accepting.set(null);
    }
  }

  async step(action: 'arrive' | 'start') {
    const t = this.trip();
    this.busy.set(true);
    try {
      const res = await this.api.post(`/driver/trips/${t.id}/${action}`);
      const next = { ...t, status: res.trip?.status ?? t.status };
      if (action === 'start') { next.startedLocal = Date.now(); this.travelled = 0; }
      this.setTrip(next);
    } catch (e) {
      this.ui.toast(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  async complete() {
    const t = this.trip();
    const mins = Math.max(1, Math.round((Date.now() - (t.startedLocal ?? Date.now())) / 60000));
    const est = Number(t.request?.estimated_distance_km ?? 0);
    const km = +(this.travelled > 0.05 ? this.travelled : est).toFixed(2);
    this.busy.set(true);
    try {
      const res = await this.api.post(`/driver/trips/${t.id}/complete`, { actual_distance_km: km, actual_duration_min: mins });
      this.summary.set({ fare: res.trip?.final_fare, km, mins });
      this.travelled = 0;
      this.setTrip(null);
      this.setOnline(true);
    } catch (e) {
      this.ui.toast(errMsg(e));
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    this.stop();
    if (this.online() && !this.trip()) await this.api.put('/driver/availability', { status: 'unavailable' }).catch(() => null);
    await this.auth.logout();
  }
}
