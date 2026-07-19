import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ContactService } from './contact.service';
import {
  LucideArrowRight,
  LucideBuilding2,
  LucideCheckCircle,
  LucideCircleAlert,
  LucideLoaderCircle,
  LucideMail,
  LucideMenu,
  LucideMessageSquare,
  LucideMoon,
  LucideSun,
  LucideUser,
  LucideX,
} from '@lucide/angular';
import { SiteContentService } from './site-content.service';
import { ThemeService } from './theme.service';
import { HeroComponent } from './hero/hero.component';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-root',
  imports: [
    HeroComponent,
    ReactiveFormsModule,
    LucideArrowRight,
    LucideBuilding2,
    LucideCheckCircle,
    LucideCircleAlert,
    LucideLoaderCircle,
    LucideMail,
    LucideMenu,
    LucideMessageSquare,
    LucideMoon,
    LucideSun,
    LucideUser,
    LucideX,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements AfterViewInit, OnDestroy {
  private readonly formBuilder = new FormBuilder();
  private readonly ngZone = inject(NgZone);
  readonly contentStore = inject(SiteContentService);
  readonly theme = inject(ThemeService);

  private readonly contactService = inject(ContactService);

  readonly menuOpen = signal(false);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly headerScrolled = signal(false);
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  readonly currentYear = new Date().getFullYear();

  /** Count shown as the services "N capabilities" measurement label. */
  readonly serviceCount = computed(() =>
    this.contentStore.services().length.toString().padStart(2, '0'),
  );

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly contactForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    company: [''],
    message: ['', [Validators.required, Validators.minLength(12)]],
  });

  readonly navItems = [
    { label: 'Services', target: 'services' },
    { label: 'Why us', target: 'why' },
    { label: 'FAQ', target: 'faq' },
    { label: 'Contact', target: 'contact' },
  ] as const;

  /**
   * All scroll-reveal tweens/triggers live in this context so a content change
   * can cleanly revert() everything and rebuild against the fresh DOM.
   * Content is ALWAYS visible by default in CSS — GSAP only hides-then-reveals
   * at runtime, so no JS (or reduced motion) means fully visible content, never
   * a blank page.
   */
  private motionContext?: gsap.Context;
  private headerTrigger?: ScrollTrigger;
  private magnetic: { el: HTMLElement; onMove: (e: PointerEvent) => void; onLeave: () => void }[] = [];
  private resizeTimer?: ReturnType<typeof setTimeout>;
  private onResize = (): void => {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 220);
  };

  constructor() {
    void this.contentStore.load();

    // Rebuild reveal choreography whenever the rendered DOM changes: both when
    // CMS content arrives AND when loading() settles without a content change
    // (the fetch-failed path — content() keeps defaults, only loading() flips,
    // but the skeleton -> real-rows DOM swap still happens and the new nodes
    // need observing).
    effect(() => {
      this.contentStore.content();
      this.contentStore.loading();
      setTimeout(() => this.setupScrollAnimation(), 0);
    });
  }

  ngAfterViewInit(): void {
    // Steadier pinning: ignore transient mobile viewport-resize (address bar)
    // refreshes that otherwise cause the pinned sections to twitch mid-scroll.
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Normalize scroll input across browsers/devices (trackpad, touch,
    // mouse-wheel) into one consistent, jank-free feed for every scrubbed
    // ScrollTrigger — the standard GSAP fix for the small up/down flashes
    // that appear when native smooth-scroll fights a scrub-driven tween.
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ScrollTrigger.normalizeScroll(true);
    }

    this.setupScrollAnimation();
    this.setupMagnetic();
    window.addEventListener('resize', this.onResize);

    // Header state is independent of content — set up once.
    this.ngZone.runOutsideAngular(() => {
      this.headerTrigger = ScrollTrigger.create({
        start: 24,
        onUpdate: (self) => {
          const scrolled = self.scroll() > 24;
          if (scrolled !== this.headerScrolled()) {
            this.ngZone.run(() => this.headerScrolled.set(scrolled));
          }
        },
      });

      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.from('.site-header', { autoAlpha: 0, y: -16, duration: 0.7, delay: 0.2 });
      }
    });
  }

  setupScrollAnimation(): void {
    this.ngZone.runOutsideAngular(() => {
      this.motionContext?.revert();

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        ScrollTrigger.refresh();
        return;
      }

      this.motionContext = gsap.context(() => {

        // Aurora orbs drift on scroll (scrubbed parallax).
        gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
          const strength = Number(el.dataset['parallax'] ?? 10);
          gsap.to(el, {
            yPercent: strength,
            ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
          });
        });

        // Headings, intro copy, forms — a single unmistakable rise + fade +
        // soft focus-pull per element. expo.out gives a fast, confident
        // finish (steep at the start, eases hard into place) rather than the
        // flatter power3 curve, so the motion actually reads as it happens
        // instead of blending into a generic fade. `once: true` guarantees
        // it fires exactly one time per element, never replaying on re-scroll.
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 44,
            duration: 1,
            ease: 'expo.out',
            // 'top 81%' sits between the too-early 88% (fires the instant an
            // edge clips the bottom of the screen) and the too-late 75% —
            // the element is already a bit into the viewport before motion
            // starts, but the reveal still reads as prompt, not delayed.
            scrollTrigger: { trigger: el, start: 'top 81%', once: true },
          });
        });

        // Ledger rows (services / values / faqs) — each row gets its OWN
        // trigger via ScrollTrigger.batch, so it animates in exactly when IT
        // individually scrolls into view, not the moment the section's first
        // row appears. Rows that happen to cross the threshold in the same
        // frame (a fast scroll, or several already in view together) still
        // stagger against each other for a natural cascade; a slow scroll
        // through a long list reveals rows one at a time, on their own.
        // opacity + transform only (no filter:blur) — blur forces a paint
        // pass rather than a compositor-only animation, and firing it across
        // a whole staggered batch during a fast scroll was a real source of
        // dropped frames ("vibration") right at the trigger moment.
        gsap.utils.toArray<HTMLElement>('[data-reveal-row]').forEach((row) => {
          gsap.set(row, { autoAlpha: 0, y: 48 });
        });

        const rowsByParent = new Map<Element, HTMLElement[]>();
        gsap.utils.toArray<HTMLElement>('[data-reveal-row]').forEach((row) => {
          const parent = row.parentElement ?? document.body;
          const group = rowsByParent.get(parent) ?? [];
          group.push(row);
          rowsByParent.set(parent, group);
        });
        rowsByParent.forEach((group) => {
          ScrollTrigger.batch(group, {
            // Same 81% threshold as the single-element reveals above, for one
            // consistent "how far into view before it animates" feel site-wide.
            start: 'top 81%',
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: 0.9,
                ease: 'expo.out',
                stagger: 0.12,
                overwrite: true,
              }),
          });
        });

        // Hairline rules draw in from the left, alongside the kicker label
        // they sit under — same 81% threshold so the two move together.
        gsap.utils.toArray<HTMLElement>('[data-rule]').forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            transformOrigin: 'left center',
            duration: 1.1,
            ease: 'power4.out',
            scrollTrigger: { trigger: el, start: 'top 81%', once: true },
          });
        });

        // Footer wordmark slides up as it enters.
        gsap.from('.footer-wordmark', {
          yPercent: 40,
          ease: 'none',
          scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: 0.5 },
        });

        // Header progress hairline tracks overall page position.
        gsap.to('.scroll-progress', {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
        });
      });

      ScrollTrigger.refresh();
    });
  }

  /** Buttons subtly follow the pointer — the "machined magnet" feel. */
  private setupMagnetic(): void {
    this.ngZone.runOutsideAngular(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (!window.matchMedia('(pointer: fine)').matches) return;

      document.querySelectorAll<HTMLElement>('.magnetic').forEach((el) => {
        const onMove = (e: PointerEvent) => {
          const r = el.getBoundingClientRect();
          const x = e.clientX - (r.left + r.width / 2);
          const y = e.clientY - (r.top + r.height / 2);
          gsap.to(el, { x: x * 0.22, y: y * 0.22, duration: 0.4, ease: 'power3.out' });
        };
        const onLeave = () => {
          gsap.to(el, { x: 0, y: 0, duration: 0.55, ease: 'elastic.out(1, 0.55)' });
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerleave', onLeave);
        this.magnetic.push({ el, onMove, onLeave });
      });
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResize);
    clearTimeout(this.resizeTimer);
    this.motionContext?.revert();
    this.headerTrigger?.kill();
    this.magnetic.forEach(({ el, onMove, onLeave }) => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    });
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  scrollTo(target: string): void {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  private showToast(type: 'success' | 'error', message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ type, message });
    this.toastTimer = setTimeout(() => this.toast.set(null), 3000);
  }

  submitContact(): void {
    this.submitted.set(true);

    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      return;
    }

    if (this.submitting()) return;

    this.submitting.set(true);
    const { name, email, company, message } = this.contactForm.getRawValue();

    this.contactService
      .submit({ name, email, company, message })
      .then(() => {
        this.contactForm.reset();
        this.submitted.set(false);
        this.showToast('success', "Message sent. We'll follow up within one business day.");
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        this.showToast('error', msg);
      })
      .finally(() => {
        this.submitting.set(false);
      });
  }

  telHref(phone: string): string {
    return 'tel:' + phone.replace(/[^\d+]/g, '');
  }
}
