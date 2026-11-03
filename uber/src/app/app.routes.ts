import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'auth' },
  {
    path: 'auth', canActivate: [guestGuard],
    loadComponent: () => import('./pages/auth.page').then(m => m.AuthPage),
  },
  {
    path: 'client', canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/client.pages').then(m => m.ClientTabsPage),
    children: [
      { path: 'home', loadComponent: () => import('./pages/client/client.pages').then(m => m.ClientHomePage) },
      { path: 'activity', loadComponent: () => import('./pages/client/client.pages').then(m => m.ClientActivityPage) },
      { path: 'account', loadComponent: () => import('./pages/client/client.pages').then(m => m.ClientAccountPage) },
      { path: '', pathMatch: 'full', redirectTo: 'home' },
    ],
  },
  {
    path: 'ride/request', canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/request.page').then(m => m.RequestPage),
  },
  {
    path: 'ride/trip', canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/trip.page').then(m => m.TripPage),
  },
  {
    path: 'driver', canActivate: [roleGuard('driver')],
    loadComponent: () => import('./pages/driver.page').then(m => m.DriverPage),
  },
  {
    path: 'admin', canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/admin.page').then(m => m.AdminPage),
  },
  { path: '**', redirectTo: 'auth' },
];
