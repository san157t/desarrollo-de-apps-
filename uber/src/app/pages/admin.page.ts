import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, IonSpinner } from '@ionic/angular/standalone';
import { Api } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Ui } from '../core/ui.service';
import { STATUS, cop, errMsg, list, tone, when } from '../config';

type Tab = 'summary' | 'drivers' | 'fares' | 'trips';

const KPIS: [string, string][] = [
  ['total_clients', 'Clientes'], ['total_drivers', 'Conductores'], ['pending_drivers', 'Por aprobar'],
  ['approved_drivers', 'Aprobados'], ['active_trips', 'Viajes activos'], ['completed_trips', 'Completados'],
  ['cancelled_trips', 'Cancelados'], ['pending_requests', 'Solicitudes'], ['total_revenue', 'Ingresos'],
];

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [FormsModule, IonContent, IonSpinner],
  template: `
  <ion-content>
    <div class="page" style="padding-bottom:12px">
      <div class="row between">
        <div><div class="muted">Panel de administración</div><h1 class="h1">Uber Admin</h1></div>
        <button class="btn alt sm" (click)="auth.logout()">Salir</button>
      </div>
    </div>
    <nav class="tabs" role="tablist" aria-label="Secciones">
      @for (t of tabs; track t.id) {
        <button role="tab" [attr.aria-selected]="tab() === t.id" [class.on]="tab() === t.id" (click)="go(t.id)">{{ t.label }}</button>
      }
    </nav>

    <div style="padding:16px 16px 32px">
      @if (loading()) { <div class="center"><ion-spinner></ion-spinner></div> }

      @switch (tab()) {
        @case ('summary') {
          <div class="kpis">
            @for (k of kpis; track k[0]) {
              <div class="kpi"><span class="muted">{{ k[1] }}</span><b>{{ k[0] === 'total_revenue' ? cop(stats()[k[0]]) : (stats()[k[0]] ?? 0) }}</b></div>
            }
          </div>
          <h2 class="sec">Viajes recientes</h2>
          @for (t of recent(); track t.id) {
            <div class="kv"><span>Viaje #{{ t.id }} <span [class]="'chip ' + tone(t.status)">{{ STATUS[t.status] ?? t.status }}</span></span><b>{{ cop(t.final_fare ?? t.estimated_fare) }}</b></div>
          } @empty { <p class="muted">Aún no hay viajes.</p> }
        }

        @case ('drivers') {
          <select class="field" aria-label="Filtrar conductores" [ngModel]="driverFilter" (ngModelChange)="driverFilter = $event; load()">
            <option value="">Todos</option><option value="pending">Pendientes</option>
            <option value="approved">Aprobados</option><option value="suspended">Suspendidos</option><option value="rejected">Rechazados</option>
          </select>
          @for (d of drivers(); track d.id) {
            <div class="card pad mt">
              <div class="row between"><b>{{ d.user?.name }}</b><span [class]="'chip ' + (d.approval_status === 'approved' ? 'green' : d.approval_status === 'pending' ? 'blue' : 'red')">{{ d.approval_status }}</span></div>
              <div class="muted">{{ d.user?.email }}</div>
              @for (v of d.vehicles ?? []; track v.plate) { <div class="muted">{{ v.brand }} {{ v.model }} {{ v.year }} · {{ v.plate }}</div> }
              <div class="muted">Licencia {{ d.license_number }} · ★ {{ d.rating_average }}</div>
              <div class="actions">
                @if (d.approval_status !== 'approved') { <button class="btn sm" (click)="decide(d, 'approved')">Aprobar</button> }
                @if (d.approval_status === 'pending') { <button class="btn sm alt" (click)="decide(d, 'rejected')">Rechazar</button> }
                @if (d.approval_status === 'approved') { <button class="btn sm alt" (click)="decide(d, 'suspended')">Suspender</button> }
              </div>
            </div>
          } @empty { @if (!loading()) { <p class="muted mt">No hay conductores con este filtro.</p> } }
        }

        @case ('fares') {
          <form class="card pad" (ngSubmit)="saveFare()">
            <h2 class="h2">Nueva tarifa</h2>
            <label class="lbl" for="fnm">Nombre</label>
            <input id="fnm" name="name" class="field" [(ngModel)]="ff.name" required>
            <div class="two">
              <div><label class="lbl" for="fb">Base</label><input id="fb" name="base" class="field" type="number" [(ngModel)]="ff.base_fare" required></div>
              <div><label class="lbl" for="fk">Por km</label><input id="fk" name="km" class="field" type="number" [(ngModel)]="ff.price_per_km" required></div>
              <div><label class="lbl" for="fm">Por minuto</label><input id="fm" name="min" class="field" type="number" [(ngModel)]="ff.price_per_minute" required></div>
              <div><label class="lbl" for="fmin">Mínima</label><input id="fmin" name="minimum" class="field" type="number" [(ngModel)]="ff.minimum_fare" required></div>
            </div>
            <label class="lbl" for="fs">Multiplicador de demanda</label>
            <input id="fs" name="surge" class="field" type="number" step="0.1" [(ngModel)]="ff.surge_multiplier" required>
            <label class="check mt"><input type="checkbox" name="active" [(ngModel)]="ff.active"> Activar esta tarifa</label>
            <button class="btn mt" type="submit" [disabled]="!fareOk()">Guardar tarifa</button>
          </form>
          <h2 class="sec">Tarifas configuradas</h2>
          @for (f of fares(); track f.id) {
            <div class="card pad" style="margin-bottom:10px">
              <div class="row between"><b>{{ f.name }}</b>@if (f.active) { <span class="chip green">Activa</span> }</div>
              <div class="muted">Base {{ cop(f.base_fare) }} · {{ cop(f.price_per_km) }}/km · {{ cop(f.price_per_minute) }}/min</div>
              <div class="muted">Mínima {{ cop(f.minimum_fare) }} · Demanda x{{ f.surge_multiplier }}</div>
            </div>
          }
        }

        @case ('trips') {
          <select class="field" aria-label="Filtrar viajes" [ngModel]="tripFilter" (ngModelChange)="tripFilter = $event; load()">
            <option value="">Todos</option><option value="assigned">Asignados</option><option value="in_progress">En curso</option>
            <option value="completed">Completados</option><option value="cancelled">Cancelados</option>
          </select>
          @for (t of trips(); track t.id) {
            <div class="kv">
              <div class="grow"><b>Viaje #{{ t.id }}</b> <span [class]="'chip ' + tone(t.status)">{{ STATUS[t.status] ?? t.status }}</span>
                <div class="muted">{{ t.client?.name }} → {{ t.driver?.user?.name }}</div>
                <div class="muted">{{ when(t.created_at) }}</div></div>
              <b>{{ cop(t.final_fare ?? t.estimated_fare) }}</b>
            </div>
          } @empty { @if (!loading()) { <p class="muted mt">No hay viajes con este filtro.</p> } }
        }
      }
    </div>
  </ion-content>`,
})
export class AdminPage implements OnInit {
  private api = inject(Api);
  private ui = inject(Ui);
  auth = inject(AuthService);
  cop = cop; when = when; tone = tone; STATUS = STATUS; kpis = KPIS;

  tabs: { id: Tab; label: string }[] = [
    { id: 'summary', label: 'Resumen' }, { id: 'drivers', label: 'Conductores' },
    { id: 'fares', label: 'Tarifas' }, { id: 'trips', label: 'Viajes' },
  ];
  tab = signal<Tab>('summary');
  loading = signal(false);
  stats = signal<any>({});
  recent = signal<any[]>([]);
  drivers = signal<any[]>([]);
  fares = signal<any[]>([]);
  trips = signal<any[]>([]);
  driverFilter = '';
  tripFilter = '';
  ff = { name: '', base_fare: null as number | null, price_per_km: null as number | null, price_per_minute: null as number | null, minimum_fare: null as number | null, surge_multiplier: 1, active: false };

  ngOnInit() { this.load(); }

  go(t: Tab) { this.tab.set(t); this.load(); }

  async load() {
    this.loading.set(true);
    try {
      switch (this.tab()) {
        case 'summary': {
          const r = await this.api.get('/admin/dashboard');
          this.stats.set(r.stats ?? {});
          this.recent.set(r.recent_trips ?? []);
          break;
        }
        case 'drivers': {
          const r = await this.api.get('/admin/drivers', this.driverFilter ? { approval_status: this.driverFilter } : undefined);
          this.drivers.set(list(r.drivers));
          break;
        }
        case 'fares': {
          const r = await this.api.get('/admin/fares');
          this.fares.set(list(r.fares));
          break;
        }
        case 'trips': {
          const r = await this.api.get('/admin/trips', this.tripFilter ? { status: this.tripFilter } : undefined);
          this.trips.set(list(r.trips));
          break;
        }
      }
    } catch (e) {
      this.ui.toast(errMsg(e));
    } finally {
      this.loading.set(false);
    }
  }

  async decide(d: any, status: 'approved' | 'rejected' | 'suspended') {
    const verb = { approved: 'Aprobar', rejected: 'Rechazar', suspended: 'Suspender' }[status];
    const notes = await this.ui.prompt(`${verb} a ${d.user?.name ?? 'conductor'}`, 'Notas para el registro (opcional)', verb);
    if (notes === null) return;
    try {
      await this.api.patch(`/admin/drivers/${d.id}/approval`, { approval_status: status, admin_notes: notes || 'Sin notas' });
      this.ui.toast('Estado actualizado');
      this.load();
    } catch (e) {
      this.ui.toast(errMsg(e));
    }
  }

  fareOk() {
    const f = this.ff;
    return !!f.name && [f.base_fare, f.price_per_km, f.price_per_minute, f.minimum_fare].every(v => v !== null && v >= 0) && f.surge_multiplier >= 1;
  }

  async saveFare() {
    try {
      await this.api.post('/admin/fares', this.ff);
      this.ui.toast('Tarifa guardada');
      this.ff = { name: '', base_fare: null, price_per_km: null, price_per_minute: null, minimum_fare: null, surge_multiplier: 1, active: false };
      this.load();
    } catch (e) {
      this.ui.toast(errMsg(e));
    }
  }
}
