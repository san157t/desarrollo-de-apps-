import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_URL } from '../config';

@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  get<T = any>(path: string, params?: Record<string, string | number>) {
    return firstValueFrom(this.http.get<T>(API_URL + path, { params }));
  }
  post<T = any>(path: string, body: unknown = {}) {
    return firstValueFrom(this.http.post<T>(API_URL + path, body));
  }
  put<T = any>(path: string, body: unknown = {}) {
    return firstValueFrom(this.http.put<T>(API_URL + path, body));
  }
  patch<T = any>(path: string, body: unknown = {}) {
    return firstValueFrom(this.http.patch<T>(API_URL + path, body));
  }
}
