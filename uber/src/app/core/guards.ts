import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const roleGuard = (role: 'client' | 'driver' | 'admin'): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.token) return router.parseUrl('/auth');
  return auth.user()?.role === role ? true : router.parseUrl(auth.home());
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.token ? router.parseUrl(auth.home()) : true;
};
