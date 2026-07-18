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
  LucideCheckCircle,
  LucideCode2,
  LucideLink,
  LucideMail,
  LucideMenu,
  LucideMoon,
  LucideSun,
  LucideX,
} from '@lucide/angular';
import { SiteContentService } from './site-content.service';
import { ThemeService } from './theme.service';
import { HeroVideoComponent } from './hero-video/hero-video.component';

gsap.registerPlugin(ScrollTrigger);

@Component({
  selector: 'app-root',
  imports: [
    HeroVideoComponent,
    ReactiveFormsModule,
    LucideArrowRight,
    LucideCheckCircle,
    LucideCode2,
    LucideLink,
    LucideMail,
    LucideMenu,
    LucideMoon,
    LucideSun,
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
  private lastCanHorizontal?: boolean;
  private onResize = (): void => {
    // Rebuild only when crossing the horizontal breakpoint — the pinned
    // horizontal gallery is a different DOM shape (pin-spacer, class toggle)
    // than the vertical stack, so ScrollTrigger's own refresh can't switch it.
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      const canHorizontal =
        !!document.querySelector('.hscroll') &&
        !!document.querySelector('[data-hscroll-track]') &&
        window.matchMedia('(min-width: 900px)').matches;
      if (canHorizontal !== this.lastCanHorizontal) {
        this.setupScrollAnimation();
      } else {
        ScrollTrigger.refresh();
      }
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

      // Services: pinned horizontal-scroll gallery on wide viewports. Vertical
      // scroll drives the track sideways. Below 900px (or reduced motion, or
      // coarse pointer) it stays a readable vertical stack — the CSS default,
      // so content is always visible even with no JS.
      const hscroll = document.querySelector<HTMLElement>('.hscroll');
      const track = document.querySelector<HTMLElement>('[data-hscroll-track]');
      hscroll?.classList.remove('hscroll--horizontal');
      const canHorizontal =
        !!hscroll && !!track && window.matchMedia('(min-width: 900px)').matches;
      this.lastCanHorizontal = canHorizontal;

      this.motionContext = gsap.context(() => {
        if (canHorizontal && hscroll && track) {
          hscroll.classList.add('hscroll--horizontal');
          const fill = document.querySelector<HTMLElement>('[data-hscroll-fill]');
          const distance = () => Math.max(0, track.scrollWidth - hscroll.clientWidth);

          gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: hscroll,
              start: 'top top',
              end: () => '+=' + distance(),
              pin: true,
              scrub: 1,
              invalidateOnRefresh: true,
              onUpdate: (self) => {
                if (fill) fill.style.transform = `scaleX(${self.progress})`;
              },
            },
          });
        }

        // Aurora orbs drift on scroll (scrubbed parallax).
        gsap.utils.toArray<HTMLElement>('[data-parallax]').forEach((el) => {
          const strength = Number(el.dataset['parallax'] ?? 10);
          gsap.to(el, {
            yPercent: strength,
            ease: 'none',
            scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
          });
        });

        // Headings, intro copy, forms — single rise + fade per element.
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            autoAlpha: 0,
            y: 28,
            duration: 0.9,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          });
        });

        // Ledger rows (services / values / faqs) — staggered per container.
        const rows = gsap.utils.toArray<HTMLElement>('[data-reveal-row]');
        const byParent = new Map<Element, HTMLElement[]>();
        rows.forEach((row) => {
          const parent = row.parentElement ?? document.body;
          const group = byParent.get(parent) ?? [];
          group.push(row);
          byParent.set(parent, group);
        });
        byParent.forEach((group) => {
          gsap.from(group, {
            autoAlpha: 0,
            y: 36,
            duration: 0.85,
            ease: 'power3.out',
            stagger: 0.09,
            scrollTrigger: { trigger: group[0], start: 'top 90%' },
          });
        });

        // Hairline rules draw in from the left.
        gsap.utils.toArray<HTMLElement>('[data-rule]').forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            transformOrigin: 'left center',
            duration: 1.1,
            ease: 'power4.out',
            scrollTrigger: { trigger: el, start: 'top 92%' },
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
