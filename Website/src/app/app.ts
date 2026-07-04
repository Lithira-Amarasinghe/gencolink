import { ChangeDetectionStrategy, Component, effect, inject, signal, AfterViewInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
  host: { '(window:load)': 'setupScrollAnimation()' },
})
export class App implements AfterViewInit {
  private readonly formBuilder = new FormBuilder();
  readonly contentStore = inject(SiteContentService);

  private readonly contactService = inject(ContactService);

  readonly menuOpen = signal(false);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);

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

  constructor() {
    void this.contentStore.load();
  }

  ngAfterViewInit(): void {
    this.setupScrollAnimation();
  }

  setupScrollAnimation(): void {
    // Observe sections for fade-in
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('fade-in-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const sectionsToObserve = document.querySelectorAll('[data-fade-in]');
    sectionsToObserve.forEach((el) => sectionObserver.observe(el));

    // Observe individual items for per-item animations
    const itemObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in-view');
            itemObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const itemsToObserve = document.querySelectorAll('.service-row, .value-item');
    itemsToObserve.forEach((el) => itemObserver.observe(el));
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
