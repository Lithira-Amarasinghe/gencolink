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
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SiteContentService } from '../site-content.service';

@Component({
  selector: 'app-hero-video',
  standalone: true,
  templateUrl: './hero-video.component.html',
  styleUrl: './hero-video.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroVideoComponent implements AfterViewInit, OnDestroy {
  private static readonly frameCount = 192;
  private static readonly framePath = '/assets/hero-story-frames/frame-';
  private static readonly frameExtension = 'png';
  private static readonly preloadConcurrency = 6;

  /**
   * Scroll distance the pinned hero occupies, in viewport heights. Sets the frame pace.
   * Set to 4vh to make frame changes gradual over a moderate scroll.
   * The next section is revealed early (at 75% of this) via a negative margin expressed
   * in vh — see `.services-section` in app.css. If this value changes, update that margin:
   * -(1 - 0.75) * scrollLengthVh * 100vh.
   * For 4vh: -(0.25 * 4 * 100vh) = -100vh
   */
  private static readonly scrollLengthVh = 4;

  @ViewChild('wrapper') private wrapperRef?: ElementRef<HTMLElement>;
  @ViewChild('sticky') private stickyRef?: ElementRef<HTMLElement>;
  @ViewChild('frameCanvas') private frameCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('heroCopy') private heroCopyRef?: ElementRef<HTMLElement>;

  private animationContext?: gsap.Context;
  private resizeObserver?: ResizeObserver;
  private readonly frames: (ImageBitmap | HTMLImageElement | undefined)[] = [];
  private currentFrameIndex = -1;
  private pendingFrameIndex = -1;
  private animationFrameId?: number;
  private pendingDrawScheduled = false;
  private destroyed = false;
  private framesReady = false;
  private lastStickyWidth = -1;
  private lastStickyHeight = -1;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  constructor(
    @Inject(PLATFORM_ID) private readonly platformId: object,
    private readonly ngZone: NgZone,
    readonly contentStore: SiteContentService,
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const canvas = this.frameCanvasRef?.nativeElement;
    const sticky = this.stickyRef?.nativeElement;
    if (!canvas || !sticky) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    this.ngZone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(sticky);
      this.resizeCanvas();
      void this.prepareFrames();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.animationContext?.revert();
    this.resizeObserver?.disconnect();

    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    this.frames.forEach((frame) => {
      if (frame instanceof ImageBitmap) {
        frame.close();
        return;
      }

      if (frame) {
        frame.onload = null;
        frame.onerror = null;
        frame.src = '';
      }
    });
  }

  private initScrollAnimation(): void {
    if (this.animationContext) {
      return;
    }

    const wrapper = this.wrapperRef?.nativeElement;
    const sticky = this.stickyRef?.nativeElement;
    const canvas = this.frameCanvasRef?.nativeElement;
    const copy = this.heroCopyRef?.nativeElement;

    if (!wrapper || !sticky || !canvas || !copy) {
      return;
    }

    const introPanel = copy.querySelector<HTMLElement>('[data-intro-panel]');
    const solutionsPanel = copy.querySelector<HTMLElement>('[data-solutions-panel]');
    const introItems = Array.from(copy.querySelectorAll<HTMLElement>('[data-intro-item]'));
    const solutionsItems = Array.from(copy.querySelectorAll<HTMLElement>('[data-solutions-item]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const playhead = { frame: 0 };

    this.drawFrame(0, true);

    this.animationContext = gsap.context(() => {
      gsap.set(introItems, { autoAlpha: 1, x: 0, y: 0, filter: 'blur(0px)' });
      gsap.set(solutionsPanel, { autoAlpha: 0, x: 38, y: 22, filter: 'blur(8px)' });
      gsap.set(solutionsItems, { autoAlpha: 0, x: 18, y: 14, filter: 'blur(6px)' });
      gsap.set(canvas, { autoAlpha: 1 });

      if (reducedMotion) {
        gsap.set(canvas, { autoAlpha: 0.94 });
        gsap.set(introPanel, { autoAlpha: 0 });
        gsap.set(solutionsPanel, { autoAlpha: 1, x: 0, y: 0, filter: 'blur(0px)' });
        gsap.set(solutionsItems, { autoAlpha: 1, x: 0, y: 0, filter: 'blur(0px)' });
        return;
      }

      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: wrapper,
            // wrapper sits below the sticky header in normal flow, so its own top never
            // reaches viewport-top(0) until you've scrolled past the header's height —
            // that dead scroll (page moves, frames don't) is exactly the header's height.
            // Offsetting the trigger point by that height makes the pin (and frame
            // animation) engage on the very first scroll pixel instead.
            start: () => 'top top+=' + (document.querySelector('.site-header')?.getBoundingClientRect().height ?? 0),
            // Full original scroll distance so the frames keep their comfortable pace.
            // Services is revealed EARLY (at 75%) not by shortening this, but by pulling
            // that section up with a negative margin (--hero-reveal-overlap, set in
            // onRefresh below and consumed in app.css). This keeps frame speed and the
            // reveal timing independent.
            end: () => '+=' + window.innerHeight * HeroVideoComponent.scrollLengthVh,
            // Lenis (see lenis-scroll.service.ts, lerp: 0.12) already smooths raw scroll
            // input. Stacking GSAP's own scrub lag on top of an already-smoothed value
            // compounds into a sluggish "catching up" feel right where the hand-off to
            // the next section should be crisp — so track scroll immediately here.
            scrub: true,
            pin: sticky,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: () => this.drawFrame(Math.round(playhead.frame)),
          },
        })
        // Frames reach the last one by 90% of scroll — the canvas stays fully opaque and
        // un-faded for the entire sequence, frame 0 through the last frame. Only once the
        // last frame is showing does the fade (below, at 0.75) begin, so the fade never
        // overlaps a still-changing frame.
        .to(
          playhead,
          {
            frame: HeroVideoComponent.frameCount - 1,
            duration: 0.9,
          },
          0,
        )
        // Intro panel visible from 0% to 37.5% (37.5% window = 1.875vh scroll)
        .to(
          introItems,
          {
            autoAlpha: 0,
            x: -38,
            y: -20,
            filter: 'blur(5px)',
            duration: 0.22,
            ease: 'power2.inOut',
            stagger: 0.075,
          },
          0.375,
        )
        .to(introPanel, { autoAlpha: 0, duration: 0.01 }, 0.375)
        // Solutions panel visible from 37.5% to 75% (37.5% window = 1.875vh scroll)
        // This balances screen time with intro panel
        .to(
          solutionsPanel,
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.15,
            ease: 'power2.out',
          },
          0.375,
        )
        .to(
          solutionsItems,
          {
            autoAlpha: 1,
            x: 0,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.16,
            ease: 'power2.out',
            stagger: 0.045,
          },
          0.375,
        )
        // Services starts rising at 70% (revealFraction, see app.css) and paints over the hero (z-index).
        // Solutions panel fades out quickly (70% → 80%, duration 0.10) to exit first.
        // Background remains visible while Solutions exits, then fades gradually (80% → 100%, duration 0.20).
        // This staggered timing creates a premium handoff: Solutions exits → Background lingers while Services
        // rises → Background fades as Services takes full control. Fades are sequenced, not simultaneous.
        .to(
          solutionsPanel,
          {
            autoAlpha: 0,
            x: -24,
            y: -14,
            filter: 'blur(5px)',
            duration: 0.10,
            ease: 'power2.out',
          },
          0.70,
        )
        .to(canvas, { autoAlpha: 0, duration: 0.20, ease: 'power2.out' }, 0.80);
    }, wrapper);

    ScrollTrigger.refresh();
  }

  private resizeCanvas(): void {
    const canvas = this.frameCanvasRef?.nativeElement;
    const sticky = this.stickyRef?.nativeElement;

    if (!canvas || !sticky) {
      return;
    }

    const { width, height } = sticky.getBoundingClientRect();

    if (Math.abs(width - this.lastStickyWidth) < 1 && Math.abs(height - this.lastStickyHeight) < 1) {
      return;
    }

    this.lastStickyWidth = width;
    this.lastStickyHeight = height;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.max(Math.round(width * pixelRatio), 1);
    canvas.height = Math.max(Math.round(height * pixelRatio), 1);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const frameToRedraw = Math.max(this.currentFrameIndex, 0);
    this.currentFrameIndex = -1;
    this.drawFrame(frameToRedraw, true);

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      if (!this.destroyed) {
        ScrollTrigger.refresh();
      }
    }, 120);
  }

  private async prepareFrames(): Promise<void> {
    try {
      this.frames[0] = await this.loadFrame(0);
      this.drawFrame(0, true);
      this.initScrollAnimation();
      // Background preload frames 1-191 without blocking animation.
      // findDrawableFrame() will substitute nearest available frame while loading.
      this.preloadRemainingFrames()
        .finally(() => {
          if (!this.destroyed) {
            this.markFramesReady();
          }
        });
    } catch {
      await this.preloadFallbackImages();
      this.drawFrame(0, true);
      this.initScrollAnimation();
      this.markFramesReady();
    }
  }

  private async preloadRemainingFrames(): Promise<void> {
    let nextIndex = 1;

    const worker = async (): Promise<void> => {
      while (!this.destroyed && nextIndex < HeroVideoComponent.frameCount) {
        const index = nextIndex;
        nextIndex += 1;

        try {
          this.frames[index] = await this.loadFrame(index);
        } catch {
          this.frames[index] = await this.loadFallbackImage(index);
        }
      }
    };

    await Promise.all(
      Array.from({ length: HeroVideoComponent.preloadConcurrency }, () => worker()),
    );
  }

  private async loadFrame(index: number): Promise<ImageBitmap> {
    const response = await fetch(this.getFrameUrl(index), { cache: 'force-cache' });
    const blob = await response.blob();
    return createImageBitmap(blob);
  }

  private loadFallbackImage(index: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const frame = new Image();
      frame.decoding = 'async';
      frame.onload = () => resolve(frame);
      frame.onerror = () => reject(new Error(`Frame failed to load: ${index}`));
      frame.src = this.getFrameUrl(index);
    });
  }

  private async preloadFallbackImages(): Promise<void> {
    const fallbackFrames = await Promise.all(
      Array.from({ length: HeroVideoComponent.frameCount }, (_, index) =>
        this.frames[index] ? Promise.resolve(this.frames[index]) : this.loadFallbackImage(index),
      ),
    );

    for (let index = 0; index < HeroVideoComponent.frameCount; index += 1) {
      this.frames[index] = fallbackFrames[index];
    }
  }

  private getFrameUrl(index: number): string {
    return `${HeroVideoComponent.framePath}${String(index + 1).padStart(4, '0')}.${
      HeroVideoComponent.frameExtension
    }`;
  }

  private markFramesReady(): void {
    if (this.framesReady) {
      return;
    }

    this.framesReady = true;
    this.stickyRef?.nativeElement.classList.add('frames-ready');
  }

  private drawFrame(index: number, force = false): void {
    const safeIndex = Math.max(0, Math.min(index, HeroVideoComponent.frameCount - 1));

    this.pendingFrameIndex = safeIndex;

    if (!force && safeIndex === this.currentFrameIndex) {
      return;
    }

    if (this.pendingDrawScheduled) {
      return;
    }

    this.pendingDrawScheduled = true;
    this.animationFrameId = requestAnimationFrame(() => {
      this.pendingDrawScheduled = false;

      const canvas = this.frameCanvasRef?.nativeElement;
      const context = canvas?.getContext('2d');

      if (!canvas || !context) {
        return;
      }

      const frameIndex = this.pendingFrameIndex;
      const frame = this.findDrawableFrame(frameIndex);
      if (!frame) {
        this.currentFrameIndex = frameIndex;
        return;
      }

      this.currentFrameIndex = frameIndex;

      const frameSize = this.getFrameSize(frame);
      const canvasRatio = canvas.width / canvas.height;
      const imageRatio = frameSize.width / frameSize.height;
      const drawHeight = imageRatio > canvasRatio ? canvas.height : canvas.width / imageRatio;
      const drawWidth = imageRatio > canvasRatio ? canvas.height * imageRatio : canvas.width;
      const dx = (canvas.width - drawWidth) / 2;
      const dy = (canvas.height - drawHeight) / 2;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(frame, dx, dy, drawWidth, drawHeight);
    });
  }

  private findDrawableFrame(index: number): ImageBitmap | HTMLImageElement | undefined {
    for (let offset = 0; offset < HeroVideoComponent.frameCount; offset += 1) {
      const before = this.frames[index - offset];
      if (this.isDrawableFrame(before)) {
        return before;
      }

      const after = this.frames[index + offset];
      if (this.isDrawableFrame(after)) {
        return after;
      }
    }

    return undefined;
  }

  private isDrawableFrame(
    frame: ImageBitmap | HTMLImageElement | undefined,
  ): frame is ImageBitmap | HTMLImageElement {
    if (!frame) {
      return false;
    }

    return frame instanceof ImageBitmap || (frame.complete && frame.naturalWidth > 0);
  }

  private getFrameSize(frame: ImageBitmap | HTMLImageElement): { width: number; height: number } {
    if (frame instanceof ImageBitmap) {
      return { width: frame.width, height: frame.height };
    }

    return { width: frame.naturalWidth, height: frame.naturalHeight };
  }
}
