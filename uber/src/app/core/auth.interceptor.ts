import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../config';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!req.url.startsWith(API_URL)) return next(req);

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = auth.token;
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return next(req.clone({ setHeaders: headers })).pipe(
    catchError(err => {
      if (err.status === 401 && !req.url.includes('/auth/login')) {
        auth.clear();
        router.navigateByUrl('/auth', { replaceUrl: true });
      }
      return throwError(() => err);
    }),
  );
};
