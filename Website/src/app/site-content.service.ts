import { Injectable, computed, signal } from '@angular/core';

export type HeroContent = {
  title: string;
  titleHighlight: string;
  description: string;
  primaryCta: string;
  secondaryCta: string;
  proofPoints: string[];
};

export type ServiceContent = {
  icon: 'code' | 'workflow' | 'data' | 'cloud' | 'globe' | 'shield';
  title: string;
  body: string;
  items: string[];
};

export type ProductContent = {
  icon: 'workflow' | 'data' | 'lock' | 'globe';
  title: string;
  body: string;
};

export type CaseStudyContent = {
  industry: string;
  title: string;
  image: string;
  summary: string;
  stats: { value: string; label: string }[];
};

export type SiteContent = {
  hero: HeroContent;
  services: ServiceContent[];
  products: ProductContent[];
  caseStudies: CaseStudyContent[];
};

const defaultContent: SiteContent = {
  hero: {
    title: 'Building software that powers a',
    titleHighlight: 'better tomorrow',
    description:
      'We design, build, and scale intelligent software solutions that drive innovation, create value, and shape the future.',
    primaryCta: 'Explore Solutions',
    secondaryCta: 'Watch Demo',
    proofPoints: ['Strategy-led delivery', 'Cloud-ready architecture', 'Fast iterations'],
  },
  services: [
    {
      icon: 'code',
      title: 'Web Design and Development',
      body: 'Professional websites, landing pages, custom web apps, and ongoing maintenance.',
      items: [
        'Personal Portfolio Websites',
        'Corporate and Company Websites',
        'Landing Pages',
        'Custom Web Applications',
        'Website Maintenance',
      ],
    },
    {
      icon: 'workflow',
      title: 'eCommerce Solutions',
      body: 'Online stores and commerce operations with payments, inventory, and marketplace support.',
      items: [
        'Online Store Development',
        'Payment Gateway Integration',
        'Order Management Systems',
        'Inventory Management',
        'Multi-Vendor Platforms',
      ],
    },
    {
      icon: 'workflow',
      title: 'Business Process Automation',
      body: 'Automation tools that reduce manual work and make approvals, CRM, and reporting easier.',
      items: [
        'Workflow Automation',
        'CRM Solutions',
        'Approval Systems',
        'Reporting Dashboards',
        'Custom Automation Tools',
      ],
    },
    {
      icon: 'data',
      title: 'Retail Management Systems',
      body: 'Retail platforms for point of sale, stock control, purchasing, and branch operations.',
      items: [
        'POS Systems',
        'Inventory Management',
        'Sales and Purchase Tracking',
        'Customer Management',
        'Multi-Branch Management',
      ],
    },
    {
      icon: 'data',
      title: 'Restaurant Management Systems',
      body: 'Restaurant operations software for POS, reservations, orders, billing, and kitchen workflows.',
      items: [
        'Restaurant POS Systems',
        'Table Reservation Systems',
        'Order and Billing Management',
        'Kitchen Display Systems',
        'Menu and Inventory Management',
      ],
    },
    {
      icon: 'cloud',
      title: 'Supply Chain Management Solutions',
      body: 'Supply chain tools for suppliers, warehouses, procurement, and connected operations.',
      items: ['Supplier Management', 'Warehouse Management', 'Procurement Management'],
    },
    {
      icon: 'globe',
      title: 'Hotel and Tourism Solutions',
      body: 'Digital systems for hotels, travel agencies, bookings, tour packages, and guest handling.',
      items: [
        'Hotel Management Systems',
        'Booking and Reservation Platforms',
        'Travel Agency Software',
        'Tour Package Management',
        'Guest Management Systems',
      ],
    },
    {
      icon: 'shield',
      title: 'Healthcare and Fitness Solutions',
      body: 'Clinic, pharmacy, appointment, patient record, and gym management systems.',
      items: [
        'Clinic Management Systems',
        'Appointment Scheduling',
        'Patient Record Management',
        'Pharmacy Management',
        'Gym Management Systems',
      ],
    },
    {
      icon: 'cloud',
      title: 'Education Technology Solutions',
      body: 'Learning and school management platforms for institutions, exams, and e-learning.',
      items: [
        'Learning Management Systems',
        'School Management Systems',
        'Student Information Systems',
        'Online Examination Systems',
        'E-Learning Platforms',
      ],
    },
    {
      icon: 'code',
      title: 'Custom Software Development',
      body: 'Tailor-made software, SaaS products, APIs, and enterprise-grade web or mobile applications.',
      items: [
        'Tailor-Made Business Applications',
        'SaaS Product Development',
        'Web and Mobile Applications',
        'API Development and Integration',
        'Enterprise Software Solutions',
      ],
    },
  ],
  products: [
    {
      icon: 'workflow',
      title: 'LinkOps',
      body: 'Platform for observability, alerts, and incident management.',
    },
    {
      icon: 'data',
      title: 'DataLink',
      body: 'Data integration and pipelines for modern analytics.',
    },
    {
      icon: 'lock',
      title: 'AuthLink',
      body: 'Secure authentication and user management made simple.',
    },
    {
      icon: 'globe',
      title: 'FlowLink',
      body: 'Workflow automation for operations and approvals.',
    },
  ],
  caseStudies: [
    {
      industry: 'Fintech',
      title: 'Payrix Mobile Platform',
      image: '/assets/case-fintech.png',
      summary: 'Modern mobile banking platform with seamless payments and real-time insights.',
      stats: [
        { value: '40%', label: 'Increase in activation' },
        { value: '99.99%', label: 'Uptime achieved' },
      ],
    },
    {
      industry: 'Logistics',
      title: 'Movu Operations Hub',
      image: '/assets/case-logistics.png',
      summary: 'Unified operations platform streamlining fleets, routes, and driver communication.',
      stats: [
        { value: '28%', label: 'Improvement in efficiency' },
        { value: '23%', label: 'Reduction in ops cost' },
      ],
    },
    {
      industry: 'Healthcare',
      title: 'Healthia Patient Portal',
      image: '/assets/case-healthcare.png',
      summary: 'Patient engagement platform with scheduling, telehealth, and secure messaging.',
      stats: [
        { value: '35%', label: 'Increase in engagement' },
        { value: '50%', label: 'Reduction in admin time' },
      ],
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  readonly content = signal<SiteContent>(defaultContent);
  readonly hero = computed(() => this.content().hero);
  readonly services = computed(() => this.content().services);
  readonly products = computed(() => this.content().products);
  readonly caseStudies = computed(() => this.content().caseStudies);

  async load(): Promise<void> {
    const base = this.getBaseUrl();
    if (!base) return;

    try {
      const [svcRes, prdRes] = await Promise.all([
        fetch(`${base}/items/services?sort=sort&filter[status][_eq]=published`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
        fetch(`${base}/items/products?sort=sort&filter[status][_eq]=published`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
      ]);

      if (!svcRes.ok || !prdRes.ok) throw new Error('CMS fetch failed');

      const [svcData, prdData] = await Promise.all([
        svcRes.json() as Promise<{ data: Record<string, unknown>[] }>,
        prdRes.json() as Promise<{ data: Record<string, unknown>[] }>,
      ]);

      const services: ServiceContent[] = svcData.data?.length
        ? svcData.data.map((r) => ({
            icon: r['icon'] as ServiceContent['icon'],
            title: r['title'] as string,
            body: r['body'] as string,
            items: Array.isArray(r['items']) ? (r['items'] as string[]) : [],
          }))
        : defaultContent.services;

      const products: ProductContent[] = prdData.data?.length
        ? prdData.data.map((r) => ({
            icon: r['icon'] as ProductContent['icon'],
            title: r['title'] as string,
            body: r['body'] as string,
          }))
        : defaultContent.products;

      this.content.update((c) => ({ ...c, services, products }));
    } catch {
      // Directus unreachable — keep default content already in signal
    }
  }

  private getBaseUrl(): string | null {
    const url = (globalThis as { __DIRECTUS_URL__?: string }).__DIRECTUS_URL__;
    return url ? url.replace(/\/$/, '') : null;
  }
}
