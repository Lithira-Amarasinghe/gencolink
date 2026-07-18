import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemePref = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const STORAGE_KEY = 'gencolink-theme';

/**
 * Theme control. Three states:
 *   - 'system' (default): follow the OS via prefers-color-scheme, no attribute.
 *   - 'light' / 'dark': a manual override, written to <html data-theme> and
 *     persisted. The CSS media query is scoped to :root:not([data-theme]) so
 *     the override always wins.
 * The no-flash inline script in index.html applies the persisted choice before
 * first paint; this service keeps the reactive signals in sync afterwards.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly media =
    isPlatformBrowser(this.platformId) && typeof matchMedia === 'function'
      ? matchMedia('(prefers-color-scheme: dark)')
      : null;

  /** The user's stored preference, including 'system'. */
  readonly preference = signal<ThemePref>('system');

  /** The theme actually on screen right now — drives the toggle icon. */
  readonly effective = signal<EffectiveTheme>('dark');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const stored = this.readStored();
    this.preference.set(stored);
    this.apply(stored);

    // If following the system, react to OS changes live.
    this.media?.addEventListener('change', () => {
      if (this.preference() === 'system') this.apply('system');
    });
  }

  /** Cycle the visible theme: whatever is on screen now flips to the other. */
  toggle(): void {
    this.set(this.effective() === 'dark' ? 'light' : 'dark');
  }

  set(pref: ThemePref): void {
    this.preference.set(pref);
    if (isPlatformBrowser(this.platformId)) {
      if (pref === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    }
    this.apply(pref);
  }

  private apply(pref: ThemePref): void {
    const root = document.documentElement;
    if (pref === 'system') {
      root.removeAttribute('data-theme');
      this.effective.set(this.media?.matches ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', pref);
      this.effective.set(pref);
    }
  }

  private readStored(): ThemePref {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      return v === 'light' || v === 'dark' ? v : 'system';
    } catch {
      return 'system';
    }
  }
}
