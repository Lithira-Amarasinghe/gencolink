import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import Lenis from 'lenis';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

@Injectable({ providedIn: 'root' })
export class LenisScrollService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private lenis?: Lenis;
  private rafId?: number;
  private started = false;

  start(): void {
    if (this.started || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.started = true;

    this.ngZone.runOutsideAngular(() => {
      this.lenis = new Lenis({
        lerp: 0.12,
        smoothWheel: true,
        syncTouch: true,
        touchMultiplier: 1.5,
      });

      this.lenis.on('scroll', () => {
        ScrollTrigger.update();
      });

      const raf = (time: number): void => {
        if (!this.lenis) {
          return;
        }

        this.lenis.raf(time);
        this.rafId = requestAnimationFrame(raf);
      };

      this.rafId = requestAnimationFrame(raf);
      this.destroyRef.onDestroy(() => this.destroy());
    });
  }

  destroy(): void {
    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
      this.rafId = undefined;
    }

    this.lenis?.destroy();
    this.lenis = undefined;
    this.started = false;
  }
}
