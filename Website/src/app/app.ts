import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactService } from './contact.service';
import {
  LucideArrowRight,
  LucideBriefcaseBusiness,
  LucideCheckCircle,
  LucideCloud,
  LucideCode2,
  LucideDatabaseZap,
  LucideGlobe,
  LucideHandshake,
  LucideHeartPulse,
  LucideLink,
  LucideLockKeyhole,
  LucideMail,
  LucideMenu,
  LucideRocket,
  LucideShieldCheck,
  LucideUsers,
  LucideWorkflow,
  LucideX,
} from '@lucide/angular';
import { HeroVideoComponent } from './hero-video/hero-video.component';
import { SiteContentService } from './site-content.service';

type CaseStudy = {
  readonly industry: string;
  readonly title: string;
  readonly image: string;
  readonly summary: string;
  readonly stats: readonly { readonly value: string; readonly label: string }[];
};

@Component({
  selector: 'app-root',
  imports: [
    HeroVideoComponent,
    NgOptimizedImage,
    ReactiveFormsModule,
    LucideArrowRight,
    LucideBriefcaseBusiness,
    LucideCheckCircle,
    LucideCloud,
    LucideCode2,
    LucideDatabaseZap,
    LucideGlobe,
    LucideHandshake,
    LucideHeartPulse,
    LucideLink,
    LucideLockKeyhole,
    LucideMail,
    LucideMenu,
    LucideRocket,
    LucideShieldCheck,
    LucideUsers,
    LucideWorkflow,
    LucideX,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly formBuilder = new FormBuilder();
  readonly contentStore = inject(SiteContentService);

  private readonly contactService = inject(ContactService);

  readonly menuOpen = signal(false);
  readonly activeCaseStudy = signal<CaseStudy | null>(null);
  readonly rolesOpen = signal(false);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  readonly contactForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    company: ['', [Validators.required, Validators.minLength(2)]],
    message: ['', [Validators.required, Validators.minLength(12)]],
  });

  readonly navItems = [
    { label: 'Services', target: 'services' },
    { label: 'Products', target: 'products' },
    { label: 'Work', target: 'work' },
    { label: 'Careers', target: 'careers' },
    { label: 'Contact', target: 'contact' },
  ] as const;

  readonly trustLogos = ['Payrix', 'Movu', 'Lumen', 'Finova', 'Healthia', 'Skylab', 'Arcus'];

  readonly openRoles = [
    'Senior Angular Engineer',
    'Cloud Platform Architect',
    'Product Designer',
    'Business Development Lead',
  ];

  constructor() {
    void this.contentStore.load();
  }

  scrollTo(target: string): void {
    document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.menuOpen.set(false);
  }

  openCaseStudy(caseStudy: CaseStudy): void {
    this.activeCaseStudy.set(caseStudy);
  }

  closeCaseStudy(): void {
    this.activeCaseStudy.set(null);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  toggleRoles(): void {
    this.rolesOpen.update((open) => !open);
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
}
