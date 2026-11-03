import { Component, inject, signal } from '@angular/core';
import {
  IonContent, IonIcon, IonInfiniteScroll, IonInfiniteScrollContent, IonLabel,
  IonRefresher, IonRefresherContent, IonTabBar, IonTabButton, IonTabs, NavController,
} from '@ionic/angular/standalone';
import { Api } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Ui } from '../../core/ui.service';
import { RatingSheetComponent } from '../../shared/rating-sheet.component';
import { STATUS, cop, errMsg, tone, when } from '../../config';

/* ------------------------------ Tabs ------------------------------ */
@Component({
  selector: 'app-client-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  template: `
  <ion-tabs>
    <ion-tab-bar slot="bottom">
      <ion-tab-button tab="home"><ion-icon name="home"></ion-icon><ion-label>Inicio</ion-label></ion-tab-button>
      <ion-tab-button tab="activity"><ion-icon name="receipt"></ion-icon><ion-label>Actividad</ion-label></ion-tab-button>
      <ion-tab-button tab="account"><ion-icon name="person"></ion-icon><ion-label>Cuenta</ion-label></ion-tab-button>
    </ion-tab-bar>
  </ion-tabs>`,
})
export class ClientTabsPage {}

/* ------------------------------ Inicio ------------------------------ */
@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [IonContent, IonIcon, IonRefresher, IonRefresherContent],
  template: `
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
    <div class="page">
      <h1 class="h1">Hola, {{ name }}</h1>
      <button class="search" (click)="nav.navigateForward('/ride/request')">
        <ion-icon name="search"></ion-icon><span>¿A dónde vas?</span>
      </button>

      @if (active(); as a) {
        <button class="live" (click)="nav.navigateForward('/ride/trip')">
          <div class="grow"><b>Tienes un viaje en curso</b><div>{{ label(a) }}</div></div>
          <ion-icon name="chevron-forward"></ion-icon>
        </button>
      }

      @if (fare(); as f) {
        <h2 class="sec">Tarifas actuales</h2>
        <div class="card">
          <div class="kv"><span>Tarifa base</span><b>{{ cop(f.base_fare) }}</b></div>
          <div class="kv"><span>Por kilómetro</span><b>{{ cop(f.price_per_km) }}</b></div>
          <div class="kv"><span>Por minuto</span><b>{{ cop(f.price_per_minute) }}</b></div>
          <div class="kv"><span>Tarifa mínima</span><b>{{ cop(f.minimum_fare) }}</b></div>
        </div>
        @if (f.surge_multiplier > 1) {
          <p class="mt"><span class="chip red">Alta demanda: precios x{{ f.surge_multiplier }}</span></p>
        }
      }
    </div>
  </ion-content>`,
})
export class ClientHomePage {
  private api = inject(Api);
  private ui = inject(Ui);
  nav = inject(NavController);
  cop = cop;
  active = signal<any>(null);
  fare = signal<any>(null);
  name = (inject(AuthService).user()?.name ?? '').split(' ')[0];

  label = (a: any) => STATUS[a?.data?.status ?? 'requested'] ?? 'En curso';

  ionViewWillEnter() { this.load(); }

  async load(ev?: any) {
    try {
      const [a, f] = await Promise.all([
        this.api.get('/client/active'),
        this.api.get('/fares/active').catch(() => null),
      ]);
      this.active.set(a.has_active ? a : null);
      this.fare.set(f?.fare ?? null);
    } catch (e) {
      this.ui.toast(errMsg(e));
    }
    ev?.target?.complete();
  }
}

/* ------------------------------ Actividad ------------------------------ */
@Component({
  selector: 'app-client-activity',
  standalone: true,
  imports: [IonContent, IonIcon, IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent, RatingSheetComponent],
  template: `
  <ion-content>
    <ion-refresher slot="fixed" (ionRefresh)="load($event)"><ion-refresher-content></ion-refresher-content></ion-refresher>
    <div class="page">
      <h1 class="h1">Actividad</h1>

      <h2 class="sec">En curso</h2>
      @if (active(); as a) {
        <button class="live" (click)="nav.navigateForward('/ride/trip')">
          <div class="grow"><b>{{ STATUS[a.data?.status ?? 'requested'] }}</b><div>Toca para ver el seguimiento</div></div>
          <ion-icon name="chevron-forward"></ion-icon>
        </button>
      } @else {
        <div class="card pad">
          No tienes viajes en curso.
          <button class="link" (click)="nav.navigateForward('/ride/request')">Pedir un viaje</button>
        </div>
      }

      <h2 class="sec">Anteriores</h2>
      @if (!loading() && !trips().length) { <p class="muted">Todavía no tienes viajes.</p> }
      @for (t of trips(); track t.id) {
        <div class="trip">
          <div class="thumb"><ion-icon name="car"></ion-icon></div>
          <div class="grow">
            <b class="ell" style="display:block">{{ title(t) }}</b>
            <div class="muted">{{ when(t.completed_at ?? t.created_at) }}</div>
            <div class="row" style="margin-top:4px">
              <span class="muted">{{ cop(t.final_fare ?? 0) }}</span>
              <span class="chip" [class]="'chip ' + tone(t.status)">{{ STATUS[t.status] ?? t.status }}</span>
            </div>
          </div>
          @if (t.status === 'completed') { <button class="btn alt sm" (click)="rating.set(t)">Calificar</button> }
        </div>
      }
      <ion-infinite-scroll (ionInfinite)="more($event)" [disabled]="page >= last">
        <ion-infinite-scroll-content></ion-infinite-scroll-content>
      </ion-infinite-scroll>
    </div>
    @if (rating(); as t) {
      <app-rating-sheet [tripId]="t.id" [driver]="t.driver?.user?.name" [fare]="t.final_fare"
                        (done)="rating.set(null)" (closed)="rating.set(null)"></app-rating-sheet>
    }
  </ion-content>`,
})
export class ClientActivityPage {
  private api = inject(Api);
  private ui = inject(Ui);
  nav = inject(NavController);
  STATUS = STATUS; cop = cop; when = when; tone = tone;
  trips = signal<any[]>([]);
  active = signal<any>(null);
  loading = signal(true);
  rating = signal<any>(null);
  page = 1;
  last = 1;

  title = (t: any) => t.destination_name ?? t.request?.destination_name ?? `Viaje con ${t.driver?.user?.name ?? 'conductor'}`;

  ionViewWillEnter() { this.load(); }

  private async fetch() {
    const r = await this.api.get('/client/trips', { page: this.page });
    const p = r.trips ?? {};
    this.last = p.last_page ?? 1;
    const data = p.data ?? [];
    this.trips.update(l => (this.page === 1 ? data : [...l, ...data]));
  }

  async load(ev?: any) {
    this.page = 1;
    try {
      const [a] = await Promise.all([this.api.get('/client/active'), this.fetch()]);
      this.active.set(a.has_active ? a : null);
    } catch (e) {
      this.ui.toast(errMsg(e));
    }
    this.loading.set(false);
    ev?.target?.complete();
  }

  async more(ev: any) {
    if (this.page < this.last) {
      this.page++;
      try { await this.fetch(); } catch (e) { this.ui.toast(errMsg(e)); }
    }
    ev.target.complete();
  }
}

/* ------------------------------ Cuenta ------------------------------ */
@Component({
  selector: 'app-client-account',
  standalone: true,
  imports: [IonContent],
  template: `
  <ion-content>
    <div class="page">
      <h1 class="h1">Cuenta</h1>
      <div class="row mt">
        <div class="avatar big">{{ (u()?.name ?? '?').charAt(0) }}</div>
        <div class="grow">
          <h2 class="h2">{{ u()?.name }}</h2>
          <div class="muted ell">{{ u()?.email }}</div>
          <div class="muted">{{ u()?.phone }}</div>
        </div>
      </div>
      <button class="btn alt mt" style="margin-top:32px" (click)="auth.logout()">Cerrar sesión</button>
    </div>
  </ion-content>`,
})
export class ClientAccountPage {
  auth = inject(AuthService);
  u = this.auth.user;
}
