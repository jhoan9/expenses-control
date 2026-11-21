import { Injectable, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

/**
 * Gestiona el tema de la app. "system" sigue la preferencia del sistema operativo
 * (prefers-color-scheme) y se actualiza si esta cambia.
 * El tema se aplica como atributo data-theme en <html>; index.html lo aplica
 * antes del arranque para evitar un parpadeo de tema incorrecto.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly media = window.matchMedia('(prefers-color-scheme: dark)');

  readonly mode = signal<ThemeMode>(this.readStored());
  readonly isDark = signal<boolean>(false);

  constructor() {
    this.apply(this.mode(), false);
    this.media.addEventListener('change', () => {
      if (this.mode() === 'system') this.apply('system', false);
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      if (mode === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* almacenamiento no disponible: el tema solo dura esta sesión */
    }
    this.apply(mode, true);
  }

  private apply(mode: ThemeMode, animate: boolean): void {
    const root = document.documentElement;
    const dark = mode === 'dark' || (mode === 'system' && this.media.matches);
    this.isDark.set(dark);

    if (animate) {
      root.classList.add('theme-switching');
      window.setTimeout(() => root.classList.remove('theme-switching'), 250);
    }

    if (mode === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);

    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#0d110f' : '#0e2a1f');
  }

  private readStored(): ThemeMode {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  }
}
