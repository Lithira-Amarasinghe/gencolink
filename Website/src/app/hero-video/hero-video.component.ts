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
            start: 'top top',
            end: 'bottom top',
            scrub: 0.25,
            pin: sticky,
            pinSpacing: true,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: () => this.drawFrame(Math.round(playhead.frame)),
          },
        })
        .to(
          playhead,
          {
            frame: HeroVideoComponent.frameCount - 1,
            duration: 1,
          },
          0,
        )
        .to(
          introItems,
          {
            autoAlpha: 0,
            x: -38,
            y: -20,
            filter: 'blur(7px)',
            duration: 0.22,
            ease: 'power2.inOut',
            stagger: 0.075,
          },
          0.3,
        )
        .to(introPanel, { autoAlpha: 0, duration: 0.01 }, 0.45)
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
          0.45,
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
          0.48,
        )
        .to(
          solutionsPanel,
          {
            autoAlpha: 0,
            x: -24,
            y: -14,
            filter: 'blur(7px)',
            duration: 0.1,
            ease: 'power2.inOut',
          },
          0.82,
        )
        .to(canvas, { autoAlpha: 0, duration: 0.06, ease: 'none' }, 0.94);
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
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.max(Math.round(width * pixelRatio), 1);
    canvas.height = Math.max(Math.round(height * pixelRatio), 1);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const frameToRedraw = Math.max(this.currentFrameIndex, 0);
    this.currentFrameIndex = -1;
    this.drawFrame(frameToRedraw, true);
    ScrollTrigger.refresh();
  }

  private async prepareFrames(): Promise<void> {
    try {
      this.frames[0] = await this.loadFrame(0);
      this.drawFrame(0, true);
      await this.preloadRemainingFrames();
      if (!this.destroyed) {
        this.initScrollAnimation();
        this.markFramesReady();
      }
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
