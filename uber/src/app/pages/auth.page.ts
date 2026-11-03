import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonContent, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../core/auth.service';
import { Ui } from '../core/ui.service';
import { errMsg } from '../config';

type Role = 'client' | 'driver' | 'admin';

const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: 'client', label: 'Usuario', hint: 'Pide viajes' },
  { id: 'driver', label: 'Conductor', hint: 'Recibe viajes' },
  { id: 'admin', label: 'Administrador', hint: 'Gestiona la plataforma' },
];
const LABEL: Record<Role, string> = { client: 'usuario', driver: 'conductor', admin: 'administrador' };

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, IonContent],
  styles: [`ion-content { --background: #000; }`],
  template: `
  <ion-content>
    <div class="auth">
      <header class="hero">
        <svg class="hero-art" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g stroke="#fff" stroke-opacity=".09" stroke-width="1" fill="none">
            <path d="M0 40H400M0 100H400M0 160H400M0 215H400M60 0V220M150 0V220M240 0V220M330 0V220"/>
            <path d="M-20 190L140 90L260 130L420 20"/>
          </g>
          <path d="M60 160V100H240V40H330" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="60" cy="160" r="8" fill="#fff"/>
          <rect x="322" y="32" width="16" height="16" fill="#fff"/>
        </svg>
        <span class="logo">Uber</span>
        <span class="tagline">Muévete a tu manera</span>
      </header>

      <main class="auth-sheet">
        @if (mode() === 'login') {
          <h1 class="h2">Inicia sesión</h1>
          <p class="muted sub">Elige cómo vas a entrar</p>

          <div class="roles" role="radiogroup" aria-label="Tipo de cuenta">
            @for (o of roles; track o.id) {
              <button type="button" role="radio" class="role" [class.on]="role() === o.id"
                      [attr.aria-checked]="role() === o.id" (click)="pick(o.id)">
                <b>{{ o.label }}</b><span>{{ o.hint }}</span>
              </button>
            }
          </div>

          <form (ngSubmit)="login()">
            <label class="lbl" for="lg">Correo o teléfono</label>
            <input id="lg" name="login" class="field" [(ngModel)]="f.login" autocomplete="username" autocapitalize="off" required>
            <label class="lbl" for="pw">Contraseña</label>
            <input id="pw" name="password" class="field" type="password" [(ngModel)]="f.password" autocomplete="current-password" required>
            <button class="btn mt" type="submit" [disabled]="busy() || !f.login || !f.password">
              {{ busy() ? 'Entrando…' : 'Entrar como ' + label() }}
            </button>
          </form>

          @if (role() !== 'admin') {
            <button class="link" type="button" (click)="mode.set('forgot')">¿Olvidaste tu contraseña?</button>
            <button class="btn alt" type="button" (click)="startRegister()">Crear cuenta de {{ label() }}</button>
          } @else {
            <p class="muted hint">Las cuentas de administrador las crea el equipo del sistema.</p>
          }
        } @else if (mode() === 'register') {
          <h1 class="h2">Crea tu cuenta</h1>
          <div class="seg" role="radiogroup" aria-label="Tipo de cuenta">
            <button type="button" role="radio" [attr.aria-checked]="r.role === 'client'" [class.on]="r.role === 'client'" (click)="r.role = 'client'">Quiero viajar</button>
            <button type="button" role="radio" [attr.aria-checked]="r.role === 'driver'" [class.on]="r.role === 'driver'" (click)="r.role = 'driver'">Quiero conducir</button>
          </div>
          <form (ngSubmit)="register()">
            <label class="lbl" for="rn">Nombre completo</label>
            <input id="rn" name="name" class="field" [(ngModel)]="r.name" autocomplete="name" required>
            <label class="lbl" for="re">Correo electrónico</label>
            <input id="re" name="email" class="field" type="email" [(ngModel)]="r.email" autocomplete="email" required>
            <label class="lbl" for="rp">Teléfono</label>
            <input id="rp" name="phone" class="field" type="tel" inputmode="tel" [(ngModel)]="r.phone" autocomplete="tel" required>
            <label class="lbl" for="rw">Contraseña</label>
            <input id="rw" name="password" class="field" type="password" [(ngModel)]="r.password" autocomplete="new-password" required>
            @if (r.role === 'driver') {
              <label class="lbl" for="rl">Número de licencia</label>
              <input id="rl" name="license" class="field" [(ngModel)]="r.license_number" required>
              <div class="two">
                <div><label class="lbl" for="rpl">Placa</label><input id="rpl" name="plate" class="field" [(ngModel)]="r.plate" required></div>
                <div><label class="lbl" for="rc">Color</label><input id="rc" name="color" class="field" [(ngModel)]="r.color" required></div>
                <div><label class="lbl" for="rb">Marca</label><input id="rb" name="brand" class="field" [(ngModel)]="r.brand" required></div>
                <div><label class="lbl" for="rm">Modelo</label><input id="rm" name="model" class="field" [(ngModel)]="r.model" required></div>
                <div><label class="lbl" for="ry">Año</label><input id="ry" name="year" class="field" type="number" inputmode="numeric" [(ngModel)]="r.year" required></div>
                <div><label class="lbl" for="rcap">Capacidad</label><input id="rcap" name="capacity" class="field" type="number" inputmode="numeric" [(ngModel)]="r.capacity" required></div>
              </div>
            }
            <button class="btn mt" type="submit" [disabled]="busy() || !regOk()">{{ busy() ? 'Creando…' : 'Crear cuenta' }}</button>
          </form>
          <button class="link" type="button" (click)="mode.set('login')">Ya tengo cuenta</button>
        } @else {
          <h1 class="h2">Restablecer contraseña</h1>
          <form (ngSubmit)="forgot()">
            <label class="lbl" for="fe">Correo electrónico</label>
            <input id="fe" name="email" class="field" type="email" [(ngModel)]="fp.email" autocomplete="email" required>
            <label class="lbl" for="fn">Nueva contraseña</label>
            <input id="fn" name="new_password" class="field" type="password" [(ngModel)]="fp.new_password" autocomplete="new-password" required>
            <button class="btn mt" type="submit" [disabled]="busy() || !fp.email || fp.new_password.length < 6">Restablecer contraseña</button>
          </form>
          <button class="link" type="button" (click)="mode.set('login')">Volver a iniciar sesión</button>
        }
      </main>
    </div>
  </ion-content>`,
})
export class AuthPage {
  private auth = inject(AuthService);
  private nav = inject(NavController);
  private ui = inject(Ui);

  roles = ROLES;
  mode = signal<'login' | 'register' | 'forgot'>('login');
  role = signal<Role>('client');
  busy = signal(false);
  f = { login: '', password: '' };
  fp = { email: '', new_password: '' };
  r = { role: 'client', name: '', email: '', phone: '', password: '', license_number: '', plate: '', brand: '', model: '', year: 2022 as number | null, capacity: 4 as number | null, color: '' };

  label() { return LABEL[this.role()]; }
  pick(r: Role) { this.role.set(r); }

  startRegister() {
    this.r.role = this.role() === 'driver' ? 'driver' : 'client';
    this.mode.set('register');
  }

  regOk() {
    const r = this.r;
    const base = !!(r.name && r.email && r.phone && r.password.length >= 6);
    return r.role === 'client' ? base : base && !!(r.license_number && r.plate && r.brand && r.model && r.year && r.capacity && r.color);
  }

  private async run(fn: () => Promise<void>) {
    this.busy.set(true);
    try { await fn(); } catch (e: any) {
      if (e?.wrongRole) {
        const real = (LABEL as Record<string, string>)[e.actual] ?? 'otro tipo';
        this.ui.toast(`Esta cuenta es de ${real}, no de ${this.label()}. Cambia la opción de arriba.`);
      } else {
        this.ui.toast(errMsg(e));
      }
    } finally { this.busy.set(false); }
  }

  login() {
    return this.run(async () => {
      await this.auth.login(this.f.login.trim(), this.f.password, this.role());
      this.nav.navigateRoot(this.auth.home());
    });
  }

  register() {
    return this.run(async () => {
      const { role, name, email, phone, password } = this.r;
      const body: any = { role, name, email, phone, password };
      if (role === 'driver') {
        Object.assign(body, {
          license_number: this.r.license_number, plate: this.r.plate, brand: this.r.brand,
          model: this.r.model, year: Number(this.r.year), capacity: Number(this.r.capacity), color: this.r.color,
        });
      }
      await this.auth.register(body);
      if (role === 'driver') this.ui.toast('Cuenta creada. Un administrador debe aprobarla antes de que puedas conectarte.');
      this.nav.navigateRoot(this.auth.home());
    });
  }

  forgot() {
    return this.run(async () => {
      const res = await this.auth.forgot(this.fp.email.trim(), this.fp.new_password);
      this.ui.toast(res.message ?? 'Contraseña restablecida.');
      this.f.login = this.fp.email;
      this.mode.set('login');
    });
  }
}
