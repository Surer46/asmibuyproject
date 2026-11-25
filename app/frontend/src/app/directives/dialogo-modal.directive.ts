import { AfterViewInit, Directive, ElementRef, HostListener, OnDestroy, inject, output } from '@angular/core';

const ENFOCABLES = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

/**
 * Comportamiento accesible para diálogos modales (H-04):
 * - role="dialog" y aria-modal="true" en el contenedor.
 * - Al abrir, el foco pasa al primer campo (o al primer control).
 * - Tab / Shift+Tab quedan dentro del diálogo.
 * - Esc emite (cerrar).
 * - Al cerrar, el foco vuelve al control que abrió el diálogo.
 *
 * Uso: <div class="modal-card" appDialogoModal aria-labelledby="titulo" (cerrar)="cerrarModales()">
 */
@Directive({
  selector: '[appDialogoModal]',
  standalone: true,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1'
  }
})
export class DialogoModalDirective implements AfterViewInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly focoPrevio: HTMLElement | null =
    typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;

  /** Se emite al pulsar Esc. */
  readonly cerrar = output<void>();

  ngAfterViewInit(): void {
    queueMicrotask(() => {
      const raiz = this.el.nativeElement;
      const campo = raiz.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
      );
      (campo ?? this.enfocables()[0] ?? raiz).focus();
    });
  }

  ngOnDestroy(): void {
    if (this.focoPrevio && document.contains(this.focoPrevio)) {
      this.focoPrevio.focus();
    }
  }

  @HostListener('keydown', ['$event'])
  alPulsarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Escape') {
      evento.stopPropagation();
      this.cerrar.emit();
      return;
    }
    if (evento.key !== 'Tab') return;

    const lista = this.enfocables();
    if (lista.length === 0) {
      evento.preventDefault();
      return;
    }
    const primero = lista[0];
    const ultimo = lista[lista.length - 1];
    const activo = document.activeElement;

    if (evento.shiftKey && (activo === primero || activo === this.el.nativeElement)) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && activo === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  private enfocables(): HTMLElement[] {
    return Array.from(this.el.nativeElement.querySelectorAll<HTMLElement>(ENFOCABLES)).filter(
      (e) => e.getClientRects().length > 0
    );
  }
}
