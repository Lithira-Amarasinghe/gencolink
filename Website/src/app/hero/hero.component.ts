import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Inject,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  effect,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SiteContentService } from '../site-content.service';

gsap.registerPlugin(ScrollTrigger);

/** A node in the interactive "link" constellation. */
interface Node {
  hx: number; // home x (CSS px)
  hy: number; // home y
  ox: number; // live offset from home
  oy: number;
  vx: number; // offset velocity
  vy: number;
  amp: number; // ambient wander radius
  phase: number;
  size: number;
  hub: boolean; // brighter, larger anchor nodes
}

interface Wash {
  x: number;
  y: number;
  r: number;
  hue: 'a' | 'b';
  vx: number;
  vy: number;
  phase: number;
}

/**
 * Hero — an interactive "link" constellation the visitor can play with.
 *
 * The brand is Gen·LINK, so the background is a living node-link network:
 *  • Nodes drift on soft ambient springs (alive even when idle).
 *  • The cursor repels nearby nodes and lights up the links around it — the
 *    field visibly parts and glows wherever the pointer goes.
 *  • An aurora wash + cursor spotlight sit under the mesh for depth and colour.
 *
 * On top: the GENCOLINK brand-band (CSS letter assembly) and the single vision
 * statement below it. Everything is visible at rest; motion only enhances.
 * Fully reduced-motion aware.
 */
@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('scene') private sceneRef?: ElementRef<HTMLElement>;
  @ViewChild('stage') private stageRef?: ElementRef<HTMLElement>;
  @ViewChild('wordmark') private wordmarkRef?: ElementRef<HTMLElement>;

  readonly brandLetters = 'GENCOLINK'.split('');

  private ctx?: CanvasRenderingContext2D;
  private nodes: Node[] = [];
  private washes: Wash[] = [];
  private rafId?: number;
  private resizeObserver?: ResizeObserver;
  private visibilityObserver?: IntersectionObserver;
  private heroVisible = true;
  private destroyed = false;
  private reducedMotion = false;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private scrollContext?: gsap.Context;
  private lastScrollY = 0;

  // Pointer state (CSS px within the viewport), lerped for smoothness.
  private pxT = -9999;
  private pyT = -9999;
  private px = -9999;
  private py = -9999;
  private mnx = 0; // normalized -0.5..0.5 for parallax
  private mny = 0;
  private mnxT = 0;
  private mnyT = 0;
  private pointerInside = false;

  private onPointerMove?: (e: PointerEvent) => void;
  private onPointerLeave?: () => void;

  // ---------- "Phantom cursor" auto-pilot ----------
  // Nobody discovers a hover-only reveal without a hint, and touch devices
  // have no hover at all. Whenever there's been no real pointer activity for
  // a bit, a virtual pointer wanders the visible hero on its own — an
  // organic random walk, not a mechanical sweep — driving the exact same
  // glow/reveal/constellation code path a real cursor would. It hands off
  // instantly the moment a real pointer moves, and resumes automatically
  // after an idle spell so the effect stays discoverable/enjoyable rather
  // than being a one-time hint.
  private readonly idleResumeMs = 1600;
  private lastRealMoveAt = -Infinity; // start idle so it plays immediately on load
  private autoPilotRunning = false;
  private autoTargetX = 0;
  private autoTargetY = 0;
  private autoVX = 0;
  private autoVY = 0;

  // Tuning
  private readonly linkDist = 132;
  private readonly mouseRadius = 210;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly ngZone: NgZone,
    readonly contentStore: SiteContentService,
  ) {
    effect(() => {
      this.contentStore.hero();
      if (this.scrollContext) this.setupScrollAnimations();
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const canvas = this.canvasRef?.nativeElement;
    const scene = this.sceneRef?.nativeElement;
    if (!canvas || !scene) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.lastScrollY = window.scrollY;

    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(scene);
      this.resize();

      // The constellation sim is O(n²) on link-distance checks (up to 132
      // nodes) plus a full canvas repaint, every single frame — real work
      // competing with the main thread for scroll's frame budget. Once the
      // hero scrolls off-screen there's nothing to gain from still running
      // it, so pause the loop entirely rather than just skipping the draw;
      // this is the fix for the scroll feeling "vibrate-y" further down the
      // page, not just a hero-local optimization.
      this.visibilityObserver = new IntersectionObserver(
        ([entry]) => {
          this.heroVisible = entry.isIntersecting;
          // The dot field's drift is a `background-position` CSS animation
          // (a paint, not a compositor-only transform) that otherwise runs
          // forever — pause it too while off-screen for the same reason.
          scene.classList.toggle('hero--offscreen', !entry.isIntersecting);
        },
        { threshold: 0 },
      );
      this.visibilityObserver.observe(scene);

      if (!this.reducedMotion) {
        this.onPointerMove = (e: PointerEvent) => {
          this.lastRealMoveAt = performance.now();
          this.pxT = e.clientX;
          this.pyT = e.clientY;
          this.mnxT = e.clientX / window.innerWidth - 0.5;
          this.mnyT = e.clientY / window.innerHeight - 0.5;
          this.pointerInside = true;
        };
        this.onPointerLeave = () => {
          this.pointerInside = false;
          this.pxT = -9999;
          this.pyT = -9999;
          // Leaving is an unambiguous "gone" signal — don't wait out the
          // idle timer, let the phantom cursor pick back up next frame.
          this.lastRealMoveAt = -Infinity;
        };
        scene.addEventListener('pointermove', this.onPointerMove, { passive: true });
        scene.addEventListener('pointerleave', this.onPointerLeave, { passive: true });
      }

      if (this.reducedMotion) {
        this.render(0, true);
      } else {
        const start = performance.now();
        const loop = (t: number): void => {
          if (this.destroyed) return;
          if (this.heroVisible) {
            this.step();
            this.render((t - start) / 1000, false);
          }
          this.rafId = requestAnimationFrame(loop);
        };
        this.rafId = requestAnimationFrame(loop);
      }

      this.setupScrollAnimations();
    });
  }

  // ---------- Simulation ----------

  private buildField(): void {
    const area = this.width * this.height;
    const count = Math.max(46, Math.min(Math.round(area / 15000), 132));
    this.nodes = [];
    for (let i = 0; i < count; i++) {
      const hub = Math.random() < 0.14;
      this.nodes.push({
        hx: Math.random() * this.width,
        hy: Math.random() * this.height,
        ox: 0,
        oy: 0,
        vx: 0,
        vy: 0,
        amp: 8 + Math.random() * 16,
        phase: Math.random() * Math.PI * 2,
        size: hub ? 2.4 + Math.random() * 1.4 : 1 + Math.random() * 1.2,
        hub,
      });
    }

    this.washes = [
      { x: 0.22, y: 0.32, r: 0.5, hue: 'b', vx: 0.01, vy: 0.006, phase: 0 },
      { x: 0.8, y: 0.24, r: 0.42, hue: 'a', vx: -0.008, vy: 0.009, phase: 2.1 },
      { x: 0.6, y: 0.85, r: 0.4, hue: 'a', vx: 0.007, vy: -0.007, phase: 4.3 },
    ];
  }

  private step(): void {
    const y = window.scrollY;
    this.lastScrollY = y;

    const idle = performance.now() - this.lastRealMoveAt > this.idleResumeMs;
    if (idle) {
      this.updateAutoPilot();
    } else {
      this.autoPilotRunning = false;
    }

    // Smooth pointer follow (snappier than before, still eased not instant)
    this.px += (this.pxT - this.px) * 0.24;
    this.py += (this.pyT - this.py) * 0.24;
    this.mnx += (this.mnxT - this.mnx) * 0.06;
    this.mny += (this.mnyT - this.mny) * 0.06;

    const stage = this.stageRef?.nativeElement;
    if (stage) {
      stage.style.setProperty('--mx', this.mnx.toFixed(4));
      stage.style.setProperty('--my', this.mny.toFixed(4));
      if (this.pointerInside) {
        stage.style.setProperty('--cx', `${this.px.toFixed(1)}px`);
        stage.style.setProperty('--cy', `${this.py.toFixed(1)}px`);
        stage.style.setProperty('--cursor-o', '1');
      } else {
        stage.style.setProperty('--cursor-o', '0');
      }
    }

    // Paint the cursor spotlight onto each statement block (px relative to
    // the block's own box) so the chromatic glitch layer lights up under the
    // pointer wherever it crosses the type.
    const type = this.wordmarkRef?.nativeElement;
    if (type) {
      type.querySelectorAll<HTMLElement>('.hero-block').forEach((block) => {
        if (this.pointerInside) {
          const r = block.getBoundingClientRect();
          block.style.setProperty('--bx', `${(this.px - r.left).toFixed(1)}px`);
          block.style.setProperty('--by', `${(this.py - r.top).toFixed(1)}px`);
        } else {
          block.style.setProperty('--bx', '-999px');
          block.style.setProperty('--by', '-999px');
        }
      });
    }

    const t = performance.now() / 1000;
    const mr = this.mouseRadius;
    const mr2 = mr * mr;

    for (const n of this.nodes) {
      // ambient wander target
      const ax = Math.cos(t * 0.5 + n.phase) * n.amp;
      const ay = Math.sin(t * 0.42 + n.phase * 1.3) * n.amp;
      n.vx += (ax - n.ox) * 0.012;
      n.vy += (ay - n.oy) * 0.012;

      // cursor repulsion
      if (this.pointerInside) {
        const nx = n.hx + n.ox;
        const ny = n.hy + n.oy;
        const dx = nx - this.px;
        const dy = ny - this.py;
        const d2 = dx * dx + dy * dy;
        if (d2 < mr2 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const f = (1 - d / mr) * 3.2;
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
        }
      }

      n.vx *= 0.86;
      n.vy *= 0.86;
      n.ox += n.vx;
      n.oy += n.vy;
    }
  }

  /**
   * Drives the phantom cursor: a damped random walk (small random
   * accelerations, heavy friction) rather than a fixed sweep, so the path
   * never repeats or reads as mechanical. Bounds are recomputed every call
   * from the hero's CURRENTLY VISIBLE region — the intersection of its
   * bounding box with the viewport — so on a tall hero (mobile, a partial
   * scroll) the wander never drifts into a part of the section that's
   * scrolled off-screen. Feeds the exact same pxT/pyT/mnxT/mnyT/
   * pointerInside state a real pointer would, so every existing reactive
   * surface (constellation repulsion, wordmark reveal mask, ambient glow)
   * lights up for free.
   */
  private updateAutoPilot(): void {
    const scene = this.sceneRef?.nativeElement;
    if (!scene) return;
    const rect = scene.getBoundingClientRect();

    const visLeft = Math.max(0, rect.left);
    const visRight = Math.min(window.innerWidth, rect.right);
    const visTop = Math.max(0, rect.top);
    const visBottom = Math.min(window.innerHeight, rect.bottom);
    if (visRight <= visLeft || visBottom <= visTop) return; // hero off-screen

    const marginX = (visRight - visLeft) * 0.14;
    const marginY = (visBottom - visTop) * 0.16;
    const minX = visLeft + marginX;
    const maxX = visRight - marginX;
    const minY = visTop + marginY;
    const maxY = visBottom - marginY;

    if (!this.autoPilotRunning) {
      // Just went idle — seed from wherever the real (or previous phantom)
      // cursor last settled, clamped into the visible band, so it picks up
      // smoothly instead of teleporting to a fresh random spot. A cursor
      // that's never touched the hero yet (fresh load) gets a sensible
      // interior point instead of the -9999 sentinel.
      const seedValid = this.px > -9000 && this.py > -9000;
      this.autoTargetX = seedValid
        ? Math.min(Math.max(this.px, minX), maxX)
        : minX + (maxX - minX) * (0.35 + Math.random() * 0.3);
      this.autoTargetY = seedValid
        ? Math.min(Math.max(this.py, minY), maxY)
        : minY + (maxY - minY) * (0.35 + Math.random() * 0.3);
      this.autoVX = 0;
      this.autoVY = 0;
      this.autoPilotRunning = true;
    }

    // Snappier than a real cursor's lazy drift, but still organic: bigger
    // random kicks, higher top speed, lighter friction.
    this.autoVX += (Math.random() - 0.5) * 3.2;
    this.autoVY += (Math.random() - 0.5) * 3.2;
    this.autoVX *= 0.95;
    this.autoVY *= 0.95;

    const speed = Math.hypot(this.autoVX, this.autoVY);
    const maxSpeed = 10;
    if (speed > maxSpeed) {
      this.autoVX = (this.autoVX / speed) * maxSpeed;
      this.autoVY = (this.autoVY / speed) * maxSpeed;
    }

    this.autoTargetX += this.autoVX;
    this.autoTargetY += this.autoVY;

    if (this.autoTargetX < minX) {
      this.autoTargetX = minX;
      this.autoVX = Math.abs(this.autoVX) * 0.6;
    } else if (this.autoTargetX > maxX) {
      this.autoTargetX = maxX;
      this.autoVX = -Math.abs(this.autoVX) * 0.6;
    }
    if (this.autoTargetY < minY) {
      this.autoTargetY = minY;
      this.autoVY = Math.abs(this.autoVY) * 0.6;
    } else if (this.autoTargetY > maxY) {
      this.autoTargetY = maxY;
      this.autoVY = -Math.abs(this.autoVY) * 0.6;
    }

    this.pxT = this.autoTargetX;
    this.pyT = this.autoTargetY;
    this.mnxT = this.pxT / window.innerWidth - 0.5;
    this.mnyT = this.pyT / window.innerHeight - 0.5;
    this.pointerInside = true;
  }

  // ---------- Rendering ----------

  private render(t: number, staticFrame: boolean): void {
    const ctx = this.ctx;
    if (!ctx || this.width === 0) return;

    const w = this.width;
    const h = this.height;
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#2ec5ff';
    const accent2 = cs.getPropertyValue('--accent-2').trim() || '#4ea8e8';
    const rgbA = this.toRgb(accent);
    const rgbB = this.toRgb(accent2);

    ctx.clearRect(0, 0, w, h);

    // 1) Aurora wash — soft colour depth, mouse-parallaxed
    const px = this.mnx * 40;
    const py = this.mny * 26;
    for (const wsh of this.washes) {
      const drift = staticFrame ? 0 : t;
      const cx = (wsh.x + Math.sin(drift * 0.05 + wsh.phase) * wsh.vx) * w + px;
      const cy = (wsh.y + Math.cos(drift * 0.04 + wsh.phase) * wsh.vy) * h + py;
      const radius = wsh.r * Math.max(w, h);
      const col = wsh.hue === 'a' ? rgbA : rgbB;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      g.addColorStop(0, `rgba(${col},0.30)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Precompute live positions
    const pts = this.nodes;
    const n = pts.length;
    const live: { x: number; y: number; hub: boolean; size: number; near: number }[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const x = p.hx + p.ox;
      const y = p.hy + p.oy;
      let near = 0;
      if (this.pointerInside) {
        const dx = x - this.px;
        const dy = y - this.py;
        const d = Math.hypot(dx, dy);
        near = d < this.mouseRadius ? 1 - d / this.mouseRadius : 0;
      }
      live[i] = { x, y, hub: p.hub, size: p.size, near };
    }

    // 2) Links between nearby nodes
    const ld = this.linkDist;
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      const a = live[i];
      for (let j = i + 1; j < n; j++) {
        const b = live[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < ld * ld) {
          const d = Math.sqrt(d2);
          const prox = 1 - d / ld;
          const boost = Math.max(a.near, b.near);
          const alpha = prox * (0.12 + boost * 0.5);
          if (alpha < 0.01) continue;
          const col = boost > 0.15 ? rgbA : rgbB;
          ctx.strokeStyle = `rgba(${col},${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // 3) Links from cursor to nearby nodes (the interactive glow)
    if (this.pointerInside) {
      for (let i = 0; i < n; i++) {
        const a = live[i];
        if (a.near <= 0) continue;
        ctx.strokeStyle = `rgba(${rgbA},${(a.near * 0.55).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(this.px, this.py);
        ctx.lineTo(a.x, a.y);
        ctx.stroke();
      }
    }

    // 4) Nodes
    for (let i = 0; i < n; i++) {
      const a = live[i];
      const baseA = a.hub ? 0.7 : 0.42;
      const alpha = Math.min(1, baseA + a.near * 0.5);
      const size = a.size + a.near * 1.6;
      ctx.beginPath();
      ctx.arc(a.x, a.y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgbA},${alpha.toFixed(3)})`;
      ctx.fill();
      if (a.near > 0.4 || a.hub) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, size + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgbA},${(0.1 * Math.max(a.near, a.hub ? 0.5 : 0)).toFixed(3)})`;
        ctx.fill();
      }
    }

  }

  // ---------- Scroll choreography (light exit fade, no blank hand-off) ----------

  /**
   * Deliberately minimal: this is a single-focus screen (wordmark + one
   * statement), not a multi-chapter sequence, so there's nothing to pin or
   * crossfade. Scrolling simply lets the hero fade/lift out of the way as
   * Services rises underneath — reduced-motion gets the plain, instant
   * hand-off. Extend or replace this timeline directly for further motion.
   */
  private setupScrollAnimations(): void {
    const scene = this.sceneRef?.nativeElement;
    if (!scene) return;

    this.scrollContext?.revert();
    if (this.reducedMotion) return;

    this.scrollContext = gsap.context(() => {
      gsap.to('.hero-wordmark, .hero-vision, .hero-foot', {
        opacity: 0,
        yPercent: -8,
        ease: 'none',
        scrollTrigger: {
          trigger: scene,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        },
      });

      gsap.to('.hero-progress-fill', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: scene,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
        },
      });
    }, scene);

    ScrollTrigger.refresh();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.rafId !== undefined) cancelAnimationFrame(this.rafId);
    const scene = this.sceneRef?.nativeElement;
    if (scene) {
      if (this.onPointerMove) scene.removeEventListener('pointermove', this.onPointerMove);
      if (this.onPointerLeave) scene.removeEventListener('pointerleave', this.onPointerLeave);
    }
    this.resizeObserver?.disconnect();
    this.visibilityObserver?.disconnect();
    this.scrollContext?.revert();
  }

  scrollTo(target: string): void {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private resize(): void {
    const canvas = this.canvasRef?.nativeElement;
    const scene = this.sceneRef?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !scene || !ctx) return;

    const { width, height } = scene.getBoundingClientRect();
    if (Math.abs(width - this.width) < 1 && Math.abs(height - this.height) < 1) return;

    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(Math.round(width * this.dpr), 1);
    canvas.height = Math.max(Math.round(height * this.dpr), 1);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.buildField();
    this.render(0, this.reducedMotion);
  }

  private toRgb(hex: string): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return '46,197,255';
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r},${g},${b}`;
  }
}
