import {
  ChangeDetectionStrategy,
  Component,
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
  LucideX,
} from '@lucide/angular';
import { HeroVideoComponent } from './hero-video/hero-video.component';
import { SiteContentService } from './site-content.service';

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

  private readonly contactService = inject(ContactService);

  readonly menuOpen = signal(false);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly headerScrolled = signal(false);
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  readonly currentYear = new Date().getFullYear();

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
      });

      ScrollTrigger.refresh();
    });
  }

  ngOnDestroy(): void {
    this.motionContext?.revert();
    this.headerTrigger?.kill();
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
