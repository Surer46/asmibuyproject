import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { VentaComponent } from './components/venta/venta.component';
import { AvisosComponent } from './components/avisos/avisos.component';
import { HistorialComponent } from './components/historial/historial.component';
import { GestionComponent } from './components/gestion/gestion.component';
import { authGuard, adminGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'venta', component: VentaComponent, canActivate: [authGuard] },
  { path: 'avisos', component: AvisosComponent, canActivate: [authGuard] },
  { path: 'historial', component: HistorialComponent, canActivate: [authGuard] },
  { path: 'gestion', component: GestionComponent, canActivate: [adminGuard] },
  { path: '', redirectTo: 'venta', pathMatch: 'full' },
  { path: '**', redirectTo: 'venta' }
];
