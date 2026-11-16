import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Api } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(Api);
  private router = inject(Router);

  user = signal<any>(this.stored());

  get token() { return localStorage.getItem('token'); }

  private stored() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }

  private save(res: any) {
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('user', JSON.stringify(res.user));
    this.user.set(res.user);
    return res.user;
  }

  async login(login: string, password: string) {
    return this.save(await this.api.post('/auth/login', { login, password }));
  }

  async register(body: any) {
    return this.save(await this.api.post('/auth/register', body));
  }

  forgot(email: string, new_password: string) {
    return this.api.post('/auth/forgot-password', { email, new_password });
  }

  async logout() {
    try { await this.api.post('/auth/logout'); } catch { /* el token puede haber expirado */ }
    this.clear();
    this.router.navigateByUrl('/auth', { replaceUrl: true });
  }

  clear() {
    ['token', 'user', 'lastRide', 'driverTrip', 'driverOnline'].forEach(k => localStorage.removeItem(k));
    this.user.set(null);
  }

  home() {
    const r = this.user()?.role;
    return r === 'driver' ? '/driver' : r === 'admin' ? '/admin' : '/client/home';
  }
}
