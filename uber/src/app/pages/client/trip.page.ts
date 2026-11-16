import { Component, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { IonIcon, IonSpinner, NavController } from '@ionic/angular';
import { Api } from '../../core/api.service';
import { GeoService } from '../../core/geo.service';
import { Ui } from '../../core/ui.service';
import { MapComponent } from '../../shared/map.component';
import { RatingSheetComponent } from '../../shared/rating-sheet.component';
import { cop, errMsg, num } from '../../config';

const TITLES: Record<string, string> = {
  assigned: 'Tu conductor va en camino',
  driver_arrived: 'Tu conductor llegó',
  in_progress: 'Vas rumbo a tu destino',
};

@Component({
  selector: 'app-trip',
  standalone: true,
  imports: [IonIcon, IonSpinner, MapComponent, RatingSheetComponent],
  template: `
  <div class="stage">
    <app-map #map></app-map>
    <button class="float-btn" aria-label="Ir al inicio" (click)="nav.navigateRoot('/client/home')"><ion-icon name="close"></ion-icon></button>

    <div class="panel">
      @if (!loaded()) {
        <div class="center"><ion-spinner></ion-spinner></div>
      } @else if (active()) {
        @if (type() === 'request') {
          <h2 class="h2">Buscando conductor…</h2>
          <div class="bar"><i></i></div>
          <p class="muted">Estamos avisando a los conductores cercanos. Puedes cerrar esta pantalla; te seguiremos buscando.</p>
        } @else {
          <h2 class="h2">{{ title() }}</h2>
          <div class="row mt">
            <div class="avatar">{{ (d().driver?.user?.name ?? '?').charAt(0) }}</div>
            <div class="grow"><b>{{ d().driver?.user?.name }}</b><div class="muted">★ {{ rating() }}</div></div>
            @if (d().driver?.user?.phone) {
              <a class="round" [href]="'tel:' + d().driver.user.phone" aria-label="Llamar al conductor"><ion-icon name="call"></ion-icon></a>
            }
          </div>
          <div class="veh">
            <div><b>{{ d().vehicle?.brand }} {{ d().vehicle?.model }}</b><div class="muted">{{ d().vehicle?.color }}</div></div>
            <span class="plate">{{ d().vehicle?.plate }}</span>
          </div>
        }
        <div class="route">
          <div class="row"><span class="dot"></span><span class="grow ell">{{ from() }}</span></div>
          <div class="row"><span class="sq"></span><span class="grow ell">{{ to() }}</span></div>
        </div>
        <div class="row between"><span class="muted">Tarifa estimada</span><b>{{ cop(d().estimated_fare) }}</b></div>
        @if (canCancel()) { <button class="btn danger mt" (click)="cancel()">Cancelar viaje</button> }
      }
    </div>

    @if (rateTrip(); as t) {
      <app-rating-sheet [tripId]="t.id" [driver]="t.driver?.user?.name" [fare]="t.final_fare"
                        (done)="home()" (closed)="home()"></app-rating-sheet>
    }
  </div>`,
})
export class TripPage implements OnDestroy {
  @ViewChild('map') map!: MapComponent;
  private api = inject(Api);
  private geo = inject(GeoService);
  private ui = inject(Ui);
  nav = inject(NavController);
  cop = cop;

  active = signal<any>(null);
  loaded = signal(false);
  rateTrip = signal<any>(null);
  d = computed<any>(() => this.active()?.data);
  type = computed<string>(() => this.active()?.type);

  private poll?: ReturnType<typeof setInterval>;
  private hadTrip = false;
  private hadAny = false;
  private routed = false;
  private fitKey = '';

  ionViewWillEnter() {
    this.hadTrip = this.hadAny = this.routed = false;
    this.fitKey = '';
    this.tick();
    this.poll = setInterval(() => this.tick(), 4000);
  }
  ionViewWillLeave() { clearInterval(this.poll); }
  ngOnDestroy() { clearInterval(this.poll); }

  title() { return TITLES[this.d()?.status] ?? 'Viaje en curso'; }
  rating() { return Number(this.d()?.driver?.rating_average ?? 0).toFixed(1); }
  canCancel() { return this.type() === 'request' || ['assigned', 'driver_arrived'].includes(this.d()?.status); }
  from() { return this.src('origin_name') ?? 'Punto de recogida'; }
  to() { return this.src('destination_name') ?? 'Destino'; }
  home() { this.nav.navigateRoot('/client/home'); }

  private src(k: string) {
    const d = this.d() ?? {};
    let s: any = {};
    try { s = JSON.parse(localStorage.getItem('lastRide') || '{}'); } catch { /* sin datos guardados */ }
    return d[k] ?? d.request?.[k] ?? d.ride_request?.[k] ?? s[k];
  }

  private async tick() {
    try {
      const r = await this.api.get('/client/active');
      if (r.has_active) {
        this.hadAny = true;
        if (r.type === 'trip') this.hadTrip = true;
        this.active.set(r);
        this.paint(r.data);
      } else {
        clearInterval(this.poll);
        this.active.set(null);
        await this.finished();
      }
    } catch { /* se reintenta en el siguiente ciclo */ }
    finally { this.loaded.set(true); }
  }

  private async finished() {
    if (!this.hadAny) { this.home(); return; }
    if (!this.hadTrip) { this.ui.toast('No se encontró conductor o la solicitud fue cancelada.'); this.home(); return; }
    try {
      const t = await this.api.get('/client/trips');
      const last = t.trips?.data?.[0];
      if (last?.status === 'completed') this.rateTrip.set(last);
      else { this.ui.toast('El viaje fue cancelado.'); this.home(); }
    } catch { this.home(); }
  }

  private paint(d: any) {
    const o = { lat: num(this.src('origin_latitude')), lng: num(this.src('origin_longitude')) };
    const t = { lat: num(this.src('destination_latitude')), lng: num(this.src('destination_longitude')) };
    const dl = d.driver?.latest_location;
    const drv = dl ? { lat: num(dl.latitude), lng: num(dl.longitude) } : null;

    this.map?.setMarker('origin', 'origin', o.lat, o.lng);
    this.map?.setMarker('dest', 'dest', t.lat, t.lng);
    if (drv) this.map?.setMarker('car', 'car', drv.lat, drv.lng);

    if (!this.routed && isFinite(o.lat) && isFinite(t.lat)) {
      this.routed = true;
      this.geo.route(o, t).then(c => this.map?.drawRoute(c));
    }
    const key = `${d.status}|${drv ? 1 : 0}`;
    if (key !== this.fitKey) {
      this.fitKey = key;
      const pts: [number, number][] = [[o.lat, o.lng], [t.lat, t.lng]];
      if (drv) pts.push([drv.lat, drv.lng]);
      this.map?.fit(pts, 330);
    }
  }

  async cancel() {
    const ok = await this.ui.confirm('¿Cancelar el viaje?', 'Solo puedes cancelar antes de que inicie el recorrido.', 'Cancelar viaje');
    if (!ok) return;
    try {
      await this.api.post(`/client/cancel/${this.d().id}`, { reason: 'Cancelado por el usuario' });
      clearInterval(this.poll);
      this.ui.toast('Viaje cancelado');
      this.home();
    } catch (e) {
      this.ui.toast(errMsg(e));
    }
  }
}
