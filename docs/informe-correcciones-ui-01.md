# Informe de correcciones de interfaz · Asmibuy · Revisión 01

> **Para:** agentes y desarrolladores del equipo 4C que van a corregir la interfaz.
> **Origen:** revisión de interfaz con el paquete *revision-interfaces v2.2* (Unidad III, ADS), iteración 01, 18/11/2026.
> **Versión revisada:** Asmibuy MVP Web Móvil 2.1.0 · commit `a7d3720` (copia local `C:\Users\santi\Documents\asmibuyproject-copia`).
> **Resultado:** **79.3/100** · cobertura 10/10 criterios · 0 bloqueos · 0 críticos · **no cumple todavía el umbral (≥ 80)**.
> **Evidencia completa:** `C:\Users\santi\Documents\revision-interfaces-v2.2\trabajos\asmibuy\iteraciones\01\` (capturas `.png`, `observaciones.json` con axe y teclado, `revision.json`, `resultado.json`, `informe.md`) y el tablero `trabajos\asmibuy\tablero.html`.

---

## 0. Reglas para el agente que corrija

1. **Trabaja sólo en la copia** `C:\Users\santi\Documents\asmibuyproject-copia` (o en una rama del repositorio si el equipo lo decide). No toques la carpeta original de Descargas.
2. **No cambies IDs de hallazgos** (`H-01` … `H-10`): la iteración 02 los compara uno por uno.
3. **No cambies el backend ni la base de datos** salvo que el hallazgo lo diga; los 10 hallazgos son de **frontend** (`app/frontend/src/app/...`).
4. **Un commit por hallazgo** con el ID en el mensaje (ej. `fix(ui): H-01 mostrar error de login`), para poder verificar regresiones.
5. Tras cada corrección, ejecuta la **verificación** indicada en su sección y `npm run build --workspace=app/frontend` sin errores.
6. **No hagas commit de** `app/backend/.env` ni de contraseñas. Las cuentas de prueba están en `C:\Users\santi\Documents\asmibuy-cuentas-prueba-local.txt` (local, no se comparte).
7. Al terminar, el alumno pedirá la **revisión 02** (`npm run trabajo -- solicitar asmibuy <nueva-version>`); el revisor reevalúa con el mismo plan.

### Cómo levantar el entorno de prueba (igual que en la revisión)

```bash
# 1. Base de datos local (Docker Desktop abierto)
docker start asmibuy-pg-local

# 2. Backend (puerto 3001) — usa app/backend/.env que apunta a 127.0.0.1:55432
cd C:\Users\santi\Documents\asmibuyproject-copia\app\backend
node dist/index.js        # o: npm start (recompila)

# 3. Frontend (puerto 4200, con proxy /api → 3001)
cd C:\Users\santi\Documents\asmibuyproject-copia\app\frontend
npm start
```

Datos ficticios cargados: 6 insumos (Queso Oaxaca en BAJO_STOCK), 5 platillos con receta, 2 promociones (3x2 en tacos, 10% en gringa), 0 ventas. Perfiles: ADMINISTRADOR y TRABAJADOR.

### Contexto técnico importante (causa común de H-01 y H-02)

`app/frontend/src/app/app.config.ts` **no registra `provideZoneChangeDetection()`**: con Angular 21 la app funciona **sin zone.js (zoneless)**. En ese modo la vista **sólo se vuelve a dibujar cuando cambia un `signal`**, se dispara un evento del template o se llama a `markForCheck()`. Cualquier **propiedad normal** (`cargando = false`, `filtroTexto = ''`) que se modifique dentro de un `subscribe`, `setTimeout` o `computed` **no actualiza la pantalla**.

👉 **Regla para todo el frontend:** el estado que se muestra en el template debe ser `signal()`. Buscar más casos con:

```bash
grep -rnE "^\s+[a-zA-Z]+ = (true|false|''|\"\"|0|null|\[\]);" app/frontend/src/app/components
```

---

## 1. Resumen y prioridad

| Orden | ID | Severidad | Criterios | Pantalla | Problema | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | **H-01** | **Alta** | C3, C5, C6 | Login | Con contraseña incorrecta se queda en «Iniciando sesión…» y no muestra el error | Bajo |
| 2 | H-02 | Media | C3, C5 | Venta | El buscador de platillos no filtra | Bajo |
| 3 | H-03 | Media | C2 | Avisos / Historial / Gestión | Recargar (F5) o abrir la URL directa manda a /venta | Medio |
| 4 | H-06 | Baja | C8 | Todas con sesión | Los íconos forman parte del nombre accesible («point_of_sale Venta», «logout») | Bajo |
| 5 | H-07 | Baja | C8 | Barra inferior móvil | Botón «Salir» con aria-label «Cerrar Sesión» | Muy bajo |
| 6 | H-05 | Media | C8 | Gestión | Botones de lápiz se llaman «edit» | Bajo |
| 7 | H-04 | Media | C7, C8 | Gestión (diálogos) | El foco no entra al diálogo; sin role="dialog" | Medio |
| 8 | H-09 | Media | C9 | Venta (móvil) | Carrito/total al final de la página | Medio |
| 9 | H-08 | Baja | C8 | Gestión · Promociones | Contraste 4.39:1 en etiqueta «PERMANENTE» | Muy bajo |
| 10 | H-10 | Baja | C4 | Gestión · Insumos y Avisos | «BAJO_STOCK» vs «BAJO STOCK»; «8000.000 g» | Bajo |

### Impacto esperado en el puntaje (estimación con la misma rúbrica, 28 unidades)

| Criterio | Ahora | Unidades que fallan | Se arregla con |
|---|---|---|---|
| C1 | 10.0 | — | — |
| C2 | **5.0** | 14 (avisos, historial, gestion-* en 2 vistas) | H-03 |
| C3 | 8.6 | 4 (login-error, venta-busqueda-vacia) | H-01, H-02 |
| C4 | 8.6 | 4 (gestion-insumos, avisos) | H-10 |
| C5 | 8.6 | 4 (login-error, venta-busqueda-vacia) | H-01, H-02 |
| C6 | 7.5 | 2 de 8 aplicables (login-error) | H-01 |
| C7 | 9.3 | 2 (gestion-modal-insumo) | H-04 |
| C8 | **2.1** | 22 (todas las pantallas con sesión) | H-06 + H-07 + H-05 + H-04 + H-08 (**hay que corregir todos** para que una unidad pase) |
| C9 | 9.6 | 1 (venta-carrito-movil) | H-09 |
| C10 | 10.0 | — | (en la revisión 02 se exige evidencia de corrección) |

- Sólo **H-01 + H-02 + H-03** → ≈ 89.6/100 (C2, C3, C5 y C6 a 10).
- **Todos** corregidos sin regresiones → hasta 100/100.
- Para declarar «cumple el umbral educativo» se necesita ≥ 80, cobertura completa, 0 bloqueos y 0 críticos abiertos.

---

## 2. Hallazgos detallados

### H-01 · Alta · Login no muestra el error con credenciales incorrectas

| Campo | Valor |
|---|---|
| Criterios | C3 (estados), C5 (retroalimentación), C6 (errores y recuperación) |
| Unidades afectadas | `login-error-movil`, `login-error-escritorio` |
| Evidencia | `iteraciones/01/login-error-movil.png`, `login-error-escritorio.png`; red: `POST /api/v1/auth/login → 401`; reproducido a mano |
| Confianza | Confirmado |

**Pasos para reproducir**
1. Abrir `http://localhost:4200/login`.
2. Correo: `admin.prueba@asmibuy.test`; contraseña: cualquier valor incorrecto.
3. Pulsar «Entrar al Sistema» y esperar 3 s.

**Observado:** el servidor responde 401 con `{codigo, mensaje}`, pero el botón se queda girando en «Iniciando sesión…», el banner `role="alert"` nunca aparece y no se puede reintentar sin recargar.
**Esperado:** el botón vuelve a «Entrar al Sistema», aparece el mensaje del servidor en el banner y el foco/lector lo anuncia.

**Causa raíz** — `app/frontend/src/app/components/login/login.component.ts`, líneas 240‑265:

```ts
mostrarPassword = false;
cargando = false;        // ← propiedad normal
errorMensaje = '';       // ← propiedad normal
...
error: (err) => {
  this.cargando = false;                // no repinta en modo zoneless
  this.errorMensaje = err.error?.mensaje || '...';
}
```

**Corrección propuesta**

```ts
import { Component, inject, signal } from '@angular/core';
...
mostrarPassword = signal(false);
cargando = signal(false);
errorMensaje = signal('');

onSubmit(): void {
  if (this.form.invalid) { this.form.markAllAsTouched(); return; }
  this.cargando.set(true);
  this.errorMensaje.set('');
  const { correo, password } = this.form.value;
  this.authService.login(correo, password).subscribe({
    next: () => this.cargando.set(false),
    error: (err) => {
      this.cargando.set(false);
      this.errorMensaje.set(err.error?.mensaje || 'Error al conectar con el servidor de autenticación.');
    }
  });
}
```

En el template cambiar `cargando` → `cargando()`, `errorMensaje` → `errorMensaje()`, `mostrarPassword` → `mostrarPassword()` y el click a `(click)="mostrarPassword.set(!mostrarPassword())"`.
Recomendado: banner con `role="alert"` y `aria-live="assertive"` (ya tiene `role="alert"`, línea ~59 del template).
Revisar también el caso **429 (bloqueo por intentos)**: debe mostrar el mensaje del servidor con los segundos de espera.

**Criterios de aceptación**
- [ ] Con contraseña incorrecta aparece el mensaje en < 1 s y el botón vuelve a «Entrar al Sistema».
- [ ] Se puede corregir la contraseña y entrar sin recargar.
- [ ] Tras 5 intentos fallidos se muestra el mensaje de bloqueo (429).
- [ ] Con credenciales correctas sigue llevando a `/venta`.

**Prompt portable para un agente**
> En `app/frontend/src/app/components/login/login.component.ts` (Angular 21 zoneless), convierte `cargando`, `errorMensaje` y `mostrarPassword` en `signal()` y actualiza el template para leerlos como funciones. Objetivo: al recibir 401/429 de `POST /api/v1/auth/login` el botón debe volver a «Entrar al Sistema» y el banner `role="alert"` debe mostrar `err.error.mensaje`. No cambies el backend. Verifica con contraseña incorrecta y correcta.

---

### H-02 · Media · El buscador de Punto de Venta no filtra

| Campo | Valor |
|---|---|
| Criterios | C3, C5 |
| Unidades afectadas | `venta-busqueda-vacia-movil`, `venta-busqueda-vacia-escritorio` |
| Evidencia | `iteraciones/01/venta-busqueda-vacia-*.png` (texto «zzzz» y contador «5 disponibles»); reproducido a mano |
| Confianza | Confirmado |

**Pasos:** iniciar sesión → en Venta escribir `zzzz` (o `taco`) en «Buscar platillo por nombre…».
**Observado:** siguen los 5 platillos; nunca aparece «No se encontraron platillos que coincidan…»; el contador no cambia.
**Esperado:** filtra al escribir; sin coincidencias muestra el estado vacío (ya existe en el template, línea ~111‑113).

**Causa raíz** — `app/frontend/src/app/components/venta/venta.component.ts`:
- Línea ~1086: `filtroTexto = '';` (propiedad normal).
- Líneas ~1110‑1114: `platillosFiltrados = computed(() => { const query = this.filtroTexto... })`. Un `computed` sólo se recalcula cuando cambia un **signal** que lee; `filtroTexto` no lo es.
- Template, línea ~94: `[(ngModel)]="filtroTexto"`; línea ~99: `(click)="filtroTexto = ''"`.

**Corrección propuesta**

```ts
filtroTexto = signal('');

platillosFiltrados = computed(() => {
  const query = this.filtroTexto().trim().toLowerCase();
  if (!query) return this.platillos();
  return this.platillos().filter(p => p.nombre.toLowerCase().includes(query));
});
```

Template:

```html
<input type="text" [ngModel]="filtroTexto()" (ngModelChange)="filtroTexto.set($event)"
       placeholder="Buscar platillo por nombre..." class="busqueda-input" aria-label="Buscar platillo" />
<button *ngIf="filtroTexto()" (click)="filtroTexto.set('')" class="btn-limpiar" aria-label="Limpiar búsqueda">…</button>
...
<p *ngIf="filtroTexto()">No se encontraron platillos que coincidan con "{{ filtroTexto() }}".</p>
<p *ngIf="!filtroTexto()">No hay platillos activos con receta válida en el catálogo.</p>
```

Opcional: ignorar acentos (`normalize('NFD').replace(/\p{Diacritic}/gu,'')`) para que «maiz» encuentre «maíz».

**Criterios de aceptación**
- [ ] `taco` deja sólo «Taco al pastor»; el contador dice «1 disponibles» (mejor: «1 disponible»).
- [ ] `zzzz` muestra el estado vacío con el texto buscado.
- [ ] El botón ✕ limpia y vuelven los 5 platillos.
- [ ] El carrito no se altera al filtrar.

**Prompt portable**
> En `venta.component.ts` (Angular 21 zoneless) el buscador no filtra porque `platillosFiltrados` es un `computed` que lee `filtroTexto`, una propiedad normal. Convierte `filtroTexto` en `signal('')`, léelo como `this.filtroTexto()` en el computed y usa `[ngModel]`/`(ngModelChange)` en el input, actualiza el botón limpiar y los textos del estado vacío. Verifica con «taco», «zzzz» y limpiar.

---

### H-03 · Media · Recargar Avisos, Historial o Gestión manda a Venta

| Campo | Valor |
|---|---|
| Criterio | C2 (acceso y retorno) |
| Unidades afectadas | 14: `avisos`, `historial`, `gestion-insumos`, `gestion-platillos`, `gestion-movimientos`, `gestion-promociones`, `gestion-modal-insumo` × móvil/escritorio |
| Evidencia | Prueba manual con sesión iniciada: navegar a `/avisos`, `/historial` y `/gestion` terminó en `/venta` cada vez |
| Confianza | Confirmado |

**Pasos:** iniciar sesión → ir a Historial por el menú → pulsar **F5** (o pegar `http://localhost:4200/gestion` en la barra).
**Observado:** pasa por `/login` y termina en `/venta`.
**Esperado:** con sesión válida, se queda en la misma pantalla; sin sesión, va a `/login` y **tras iniciar sesión regresa a la pantalla pedida**.

**Causa raíz**
1. `app/frontend/src/app/guards/auth.guard.ts`: `authGuard` y `adminGuard` consultan `authService.estaAutenticado()` **de forma síncrona**. Al recargar, `usuarioActual` todavía es `null` porque `GET /api/v1/auth/me` no ha respondido → redirigen a `/login`.
2. `app/frontend/src/app/services/auth.service.ts`, `verificarSesionInicial()` (líneas ~45‑65): cuando `/me` responde y la URL es `/login`, hace `router.navigate(['/venta'])`; `login()` (línea ~95) también navega fijo a `/venta`. Se pierde la ruta original.
3. `adminGuard` además manda a `/venta` (no a `/login`) cuando todavía no se sabe si hay sesión.

**Corrección propuesta** (`auth.guard.ts`)

```ts
import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

const esperarSesion = () => {
  const auth = inject(AuthService);
  return toObservable(auth.cargando).pipe(filter(c => !c), take(1), map(() => auth));
};

export const authGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return esperarSesion().pipe(map(auth =>
    auth.estaAutenticado() ? true : router.createUrlTree(['/login'], { queryParams: { volver: state.url } })
  ));
};

export const adminGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  return esperarSesion().pipe(map(auth => {
    if (!auth.estaAutenticado()) return router.createUrlTree(['/login'], { queryParams: { volver: state.url } });
    return auth.esAdmin() ? true : router.createUrlTree(['/venta']);
  }));
};

export const guestGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  return esperarSesion().pipe(map(auth =>
    auth.estaAutenticado() ? router.parseUrl(seguro(route.queryParamMap.get('volver'))) : true
  ));
};

// Evita redirecciones abiertas: sólo rutas internas
export function seguro(url: string | null): string {
  return url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/login') ? url : '/venta';
}
```

En `auth.service.ts`:
- `verificarSesionInicial()`: **quitar** el `router.navigate(['/venta'])` (ahora lo resuelve `guestGuard`).
- `login()`: navegar a `seguro(this.router.routerState.snapshot.root.queryParamMap.get('volver'))` en lugar de `/venta` fijo.
- `toObservable` debe llamarse en contexto de inyección (dentro del guard está bien).

**Criterios de aceptación**
- [ ] Con sesión: F5 en `/avisos`, `/historial`, `/gestion` conserva la pantalla.
- [ ] Sin sesión: abrir `/historial` → `/login?volver=%2Fhistorial` → tras entrar regresa a `/historial`.
- [ ] Trabajador que abre `/gestion` → termina en `/venta` (sin acceso).
- [ ] `volver=https://otro-sitio` o `//otro` → se ignora y va a `/venta`.
- [ ] Usuario con sesión que abre `/login` → va a `/venta`.

**Prompt portable**
> En Asmibuy (Angular 21, `app/frontend/src/app/guards/auth.guard.ts` y `services/auth.service.ts`), los guards leen `estaAutenticado()` antes de que termine `GET /api/v1/auth/me`, así que al recargar /avisos, /historial o /gestion se redirige a /login y luego a /venta. Haz que los guards esperen a `auth.cargando() === false` (toObservable + filter + take(1)), devuelvan `UrlTree` con `?volver=<url>` y que el login regrese a esa ruta validando que sea interna. Quita la navegación fija a /venta de `verificarSesionInicial`. Verifica F5 en las tres rutas, el perfil Trabajador en /gestion y que no haya redirección abierta.

---

### H-04 · Media · Los diálogos de Gestión no reciben el foco ni se anuncian

| Campo | Valor |
|---|---|
| Criterios | C7 (teclado), C8 (estructura accesible) |
| Unidades afectadas | `gestion-modal-insumo-movil`, `gestion-modal-insumo-escritorio` (el mismo patrón está en los 5 diálogos) |
| Evidencia | `observaciones.json`: con el diálogo abierto, 6 pulsaciones de Tab recorren los botones «edit» del fondo antes de llegar a «✕»; captura `gestion-modal-insumo-escritorio.png` |
| Confianza | Confirmado |

**Pasos:** iniciar sesión como administrador → Gestión → «Nuevo Insumo» → pulsar Tab varias veces.
**Observado:** el foco se queda en el botón que abrió el diálogo y Tab recorre la página de fondo; no hay `role="dialog"`, `aria-modal` ni cierre con Esc. El botón «✕» no tiene nombre accesible claro.
**Esperado:** al abrir, el foco va al primer campo; Tab/Shift+Tab quedan dentro; Esc cierra; al cerrar, el foco regresa al botón que lo abrió; el lector anuncia «Nuevo Insumo, diálogo».

**Ubicación** — `app/frontend/src/app/components/gestion/gestion.component.ts`, diálogos en las líneas ~332 (Insumo), ~406 (Platillo), ~502 (Entrada), ~557 (Ajuste), ~614 (Promoción):

```html
<div *ngIf="mostrarModalIngrediente()" class="modal-overlay">
  <div class="modal-card card-cupertino">
    <div class="modal-header">
      <h3>{{ ... 'Nuevo Insumo' }}</h3>
      <button class="btn-cerrar" (click)="cerrarModales()">✕</button>
```

**Corrección propuesta** (opción recomendada: CDK, que ya maneja foco y trampa)

- **Opción A — `@angular/cdk/a11y`:** `npm i @angular/cdk@21 --workspace=app/frontend` y en cada diálogo:

```html
<div *ngIf="mostrarModalIngrediente()" class="modal-overlay" (keydown.escape)="cerrarModales()">
  <div class="modal-card card-cupertino" role="dialog" aria-modal="true"
       aria-labelledby="titulo-modal-ingrediente" cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
    <div class="modal-header">
      <h3 id="titulo-modal-ingrediente">…</h3>
      <button type="button" class="btn-cerrar" (click)="cerrarModales()" aria-label="Cerrar">
        <span aria-hidden="true">✕</span>
      </button>
```

  Importar `A11yModule` en el componente. `cdkTrapFocusAutoCapture` lleva el foco al primer campo y lo devuelve al cerrar.

- **Opción B — `<dialog>` nativo** con `showModal()` (trae trampa de foco, Esc y `inert` del fondo).

Repetir en los 5 diálogos de Gestión y revisar también los de `venta.component.ts` (comprobante, línea ~298, ya tiene `id="modal-comprobante-titulo"`) e `historial.component.ts` (comprobante ~198 y anulación ~293).

**Criterios de aceptación**
- [ ] Al abrir «Nuevo Insumo» el foco está en «Nombre del Insumo».
- [ ] Tab y Shift+Tab nunca salen del diálogo.
- [ ] Esc cierra; el foco vuelve a «Nuevo Insumo».
- [ ] axe no reporta `aria-dialog-name`; el lector anuncia el título.
- [ ] Lo mismo en Platillo, Entrada, Ajuste y Promoción.

**Prompt portable**
> En `gestion.component.ts` los 5 diálogos (`.modal-overlay`) no tienen role="dialog", no capturan el foco y no cierran con Esc. Añade `role="dialog" aria-modal="true" aria-labelledby` con id en cada `<h3>`, trampa de foco con `cdkTrapFocus [cdkTrapFocusAutoCapture]="true"` de `@angular/cdk/a11y` (o `<dialog>` nativo), `(keydown.escape)="cerrarModales()"` y `aria-label="Cerrar"` en el botón ✕. Aplica el mismo patrón a los diálogos de venta e historial. Verifica con teclado.

---

### H-05 · Media · Botones de lápiz con nombre accesible «edit»

| Campo | Valor |
|---|---|
| Criterio | C8 |
| Unidades afectadas | `gestion-insumos`, `gestion-platillos`, `gestion-modal-insumo` (× 2 vistas) |
| Evidencia | `observaciones.json` (secuencia de teclado: «BUTTON:edit» repetido); `gestion-insumos-movil.png` |
| Confianza | Confirmado |

**Observado:** el nombre accesible es el texto de la ligadura del ícono (`edit`); el `title` no se usa porque el botón ya tiene contenido. Todos los lápices suenan igual.
**Esperado:** «Editar Cebolla», «Editar receta de Gringa».

**Ubicación** — `gestion.component.ts`:
- Línea ~125: `<button class="btn-icon" (click)="editarIngrediente(ing)" title="Editar insumo"><span class="material-symbols-rounded">edit</span></button>`
- Línea ~175: `<button class="btn-icon" (click)="editarPlatillo(plat)" title="Editar receta">…edit…</button>`

**Corrección**

```html
<button type="button" class="btn-icon" (click)="editarIngrediente(ing)"
        [attr.aria-label]="'Editar ' + ing.nombre" [title]="'Editar ' + ing.nombre">
  <span class="material-symbols-rounded" aria-hidden="true">edit</span>
</button>

<button type="button" class="btn-icon" (click)="editarPlatillo(plat)"
        [attr.aria-label]="'Editar receta de ' + plat.nombre" [title]="'Editar receta de ' + plat.nombre">
  <span class="material-symbols-rounded" aria-hidden="true">edit</span>
</button>
```

Los botones de Promociones (Editar/Pausar/Retirar, líneas ~298‑317) ya tienen aria-label; conviene añadir el nombre de la promoción (`'Pausar 3x2 en tacos'`).

**Criterios de aceptación:** cada lápiz se anuncia con el nombre de su fila; no hay dos botones con el mismo nombre accesible en la misma lista.

---

### H-06 · Baja · El texto de los íconos se lee como parte del nombre

| Campo | Valor |
|---|---|
| Criterio | C8 |
| Unidades afectadas | Todas las pantallas con sesión (11 páginas × 2 vistas) |
| Evidencia | `observaciones.json`: nombres «point_of_sale Venta», «notifications Avisos», «receipt_long Historial», «admin_panel_settings Gestión», «egg Insumos (6)», «refresh Actualizar», «add Nuevo Insumo», «logout» |
| Confianza | Confirmado |

**Causa:** Material Symbols funciona con **ligaduras**: el `<span class="material-symbols-rounded">point_of_sale</span>` contiene la palabra real, que el lector de pantalla lee. En el proyecto hay **73** spans de ícono y **0** `aria-hidden`.

**Corrección (global)**
1. Añadir `aria-hidden="true"` a **todos** los `<span class="material-symbols-rounded">` que acompañan texto visible:

   ```bash
   # revisar el resultado antes de commitear
   cd app/frontend/src/app
   grep -rln 'class="material-symbols-rounded' components | xargs sed -i 's/<span class="material-symbols-rounded"/<span class="material-symbols-rounded" aria-hidden="true"/g'
   ```

   (Cuidado con los spans que tienen otras clases o `[class.x]`; buscarlos también con `grep -rn "material-symbols-rounded " components`.)
2. Botones **sólo con ícono** necesitan `aria-label`:
   - `navbar.component.ts` línea ~82: `<button (click)="logout()" class="btn-logout" title="Cerrar Sesión">` → añadir `aria-label="Cerrar sesión"`.
   - Botones de lápiz (ver H-05) y ✕ de diálogos (ver H-04).
3. Alternativa más limpia: un componente `<app-icono nombre="edit" />` que siempre ponga `aria-hidden="true"`.

**Criterios de aceptación:** en DevTools → Accesibilidad, los enlaces del menú se llaman «Venta», «Avisos», «Historial», «Gestión»; las pestañas «Insumos (6)», etc.; el botón de salir «Cerrar sesión».

---

### H-07 · Baja · Botón «Salir» (móvil) con nombre distinto al visible

| Campo | Valor |
|---|---|
| Criterio | C8 |
| Unidades afectadas | Todas las pantallas con sesión en vista **móvil** |
| Evidencia | axe `label-content-name-mismatch` (serious) en `.tab-btn` |
| Confianza | Confirmado |

**Ubicación:** `navbar.component.ts` línea ~120:

```html
<button (click)="logout()" class="mobile-tab tab-btn" aria-label="Cerrar Sesión" title="Cerrar Sesión">
  …<span class="tab-label">Salir</span>
```

**Corrección:** quitar el `aria-label` (el texto visible «Salir» basta, una vez que el ícono tenga `aria-hidden`) **o** cambiar el texto visible y el aria-label para que coincidan (p. ej. ambos «Salir»). Mantener `title` si se desea.

**Criterio de aceptación:** axe sin `label-content-name-mismatch` en vista 390×844.

---

### H-08 · Baja · Contraste insuficiente en etiqueta «PERMANENTE»

| Campo | Valor |
|---|---|
| Criterio | C8 |
| Unidades afectadas | `gestion-promociones-movil`, `gestion-promociones-escritorio` |
| Medición | **4.39:1** (`#71717a` sobre `#f4f4f5`, 12.8 px normal); requerido **4.5:1** (WCAG 1.4.3) |
| Evidencia | axe `color-contrast` (serious), 2 nodos `.badge-inactivo` |

**Ubicación:** `gestion.component.ts` línea ~980:

```css
.badge-inactivo { background: #f4f4f5; color: #71717a; border: 1px solid #e4e4e7; }
```

**Corrección:** `color: #52525b;` (≈ 7.0:1) o `#3f3f46`. Revisar otras etiquetas grises con la misma paleta.

**Criterio de aceptación:** axe sin `color-contrast` en Promociones.

---

### H-09 · Media · En móvil el carrito y el total quedan al final

| Campo | Valor |
|---|---|
| Criterio | C9 (adaptación móvil) |
| Unidad afectada | `venta-carrito-movil` |
| Evidencia | `iteraciones/01/venta-carrito-movil.png` (página de 1735 px; carrito, total $67.50 y «Confirmar Venta» después de los 5 platillos) |
| Confianza | Confirmado |

**Observado:** en 390×844, al agregar sólo aparece «1 en carrito» en la tarjeta; para ver el total o cobrar hay que desplazarse por todo el catálogo. Con un menú real (20‑40 platillos) la tarea principal del cajero se vuelve lenta.
**Esperado:** un resumen siempre visible (encima de la barra inferior) con artículos, total y botón «Ver carrito / Cobrar».

**Ubicación:** `venta.component.ts`: sección `<section class="carrito-section">` (línea ~147); el layout en 2 columnas sólo se activa con `@media (min-width: 900px)` (línea ~479‑482). En móvil la columna es única y el carrito queda abajo.

**Corrección propuesta**

```html
<!-- Sólo móvil: barra de resumen fija -->
<button type="button" class="resumen-carrito-movil" *ngIf="carrito().length > 0"
        (click)="irAlCarrito()" [attr.aria-label]="'Ver carrito: ' + totalArticulos() + ' artículos, total ' + (cotizacion()?.total | currency)">
  <span>{{ totalArticulos() }} artículos</span>
  <strong>{{ cotizacion()?.total | currency }}</strong>
  <span>Ver carrito</span>
</button>
```

```css
.resumen-carrito-movil { position: fixed; left: 12px; right: 12px; bottom: calc(64px + env(safe-area-inset-bottom)); z-index: 40; /* encima de la barra inferior */ }
@media (min-width: 900px) { .resumen-carrito-movil { display: none; } }
```

`irAlCarrito()` hace `document.querySelector('.carrito-section')?.scrollIntoView({behavior:'smooth'})` y mueve el foco al encabezado del carrito. Añadir `padding-bottom` al contenido para que la barra no tape el último platillo.

**Criterios de aceptación**
- [ ] En 390×844, tras agregar un platillo, el total es visible sin desplazarse.
- [ ] La barra no tapa contenido ni la navegación inferior.
- [ ] En escritorio (≥ 900 px) no aparece.

---

### H-10 · Baja · Textos de estado y cantidades poco legibles / inconsistentes

| Campo | Valor |
|---|---|
| Criterio | C4 (legibilidad y consistencia) |
| Unidades afectadas | `gestion-insumos-*`, `avisos-*` |
| Evidencia | `gestion-insumos-movil.png` («BAJO_STOCK», «8000.000 g»), `avisos-*.png` («BAJO STOCK», «600.000 g») |

**Ubicación**
- `gestion.component.ts` línea ~114: `{{ ing.estadoStock }}` muestra el valor crudo del enum (`BAJO_STOCK`).
- `avisos.component.ts` línea ~64: texto fijo `BAJO STOCK`.
- Cantidades: `{{ ing.existencia }} {{ ing.unidad }}` (gestion ~120, ~518, ~573) y `{{ aviso.existencia }}` / `{{ aviso.minimo }}` (avisos ~55‑57). El backend las envía como texto `NUMERIC(10,3)` → «8000.000».

**Corrección**
1. Un *pipe* compartido `estadoStock`: `{ NORMAL: 'Normal', BAJO_STOCK: 'Bajo stock', AGOTADO: 'Agotado' }`, usado en Gestión y Avisos.
2. Un *pipe* `cantidad`: `Number(valor).toLocaleString('es-MX', { maximumFractionDigits: 3 })` → «8,000 g», «0.5 g», «300 pieza(s)».
3. Opcional: pluralizar `pieza` → `piezas`.

**Criterio de aceptación:** el mismo estado se escribe igual en todas las pantallas; ninguna cantidad muestra ceros decimales sobrantes.

---

## 3. Lo que NO se evaluó (posibles problemas ocultos)

Estas pantallas/estados quedaron **fuera del alcance** de la revisión 01 porque escriben en la base de datos. Si el equipo las corrige o cambia, conviene revisarlas también (y el alumno puede pedir ampliar el plan en la revisión 02):

- Confirmar venta, comprobante, «Nueva venta», recuperación de venta pendiente (`venta.component.ts`).
- Detalle y anulación de ventas (`historial.component.ts`) — el historial estaba vacío.
- Guardar insumo/platillo/promoción, entradas y ajustes de inventario, pausar/retirar promociones (`gestion.component.ts`).
- Mensajes de error del backend en esos formularios (409 duplicado, 422 validación, `STOCK_INSUFICIENTE`, `COTIZACION_DESACTUALIZADA`).

⚠️ Por la causa común de H-01/H-02 (zoneless + propiedades normales), **es probable que haya más estados que no se repintan** en esos flujos. Ejecutar el `grep` de la sección 0 y convertir a `signal()` todo estado que se muestre.

## 4. Lo que sí está bien (no romper)

- Login con validación de campos obligatorios y botón deshabilitado con formulario inválido.
- Navegación por menú con estado activo; el perfil **Trabajador no ve Gestión** (correcto).
- Sin desbordamiento horizontal en 390 px ni 1280 px en ninguna de las 28 unidades.
- Foco visible: contorno verde de 3 px en botones/enlaces y borde naranja con halo en campos del login.
- Controles del carrito con nombres claros («Sumar uno a Taco al pastor», «Vaciar carrito»).
- Avisos destaca correctamente el insumo en bajo stock.
- `<html lang="es">` y `<main>` presentes.

## 5. Checklist de verificación antes de pedir la revisión 02

- [ ] H-01 … H-10 corregidos (o justificados por escrito si alguno se pospone).
- [ ] `npm run build --workspace=app/frontend` sin errores.
- [ ] Prueba manual: login incorrecto → mensaje; buscador «taco»/«zzzz»; F5 en /historial; Tab en «Nuevo Insumo»; vista móvil del carrito.
- [ ] axe (extensión del navegador o DevTools Lighthouse) sin `label-content-name-mismatch` ni `color-contrast` en Venta y Promociones.
- [ ] Nada de `.env`, contraseñas ni `node_modules` en los commits.
- [ ] Anotar la **nueva versión** (p. ej. `2.1.1` o el commit) para la solicitud: `npm run trabajo -- solicitar asmibuy <version>`.

---

*Limitaciones:* revisión hecha por un agente con Playwright 1.65 + axe-core 4.14 sobre Edge, en la copia local con BD Docker y datos ficticios; no hubo pruebas con usuarios reales; no certifica WCAG. Las líneas de código son aproximadas (commit `a7d3720`) y pueden moverse con cambios posteriores.
