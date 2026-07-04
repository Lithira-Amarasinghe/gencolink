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

export type ValueContent = {
  title: string;
  body: string;
};

export type FaqContent = {
  question: string;
  answer: string;
};

export type WhySectionContent = {
  eyebrow: string;
  heading: string;
  description: string;
};

export type FaqSectionContent = {
  eyebrow: string;
  heading: string;
};

export type ServicesSectionContent = {
  eyebrow: string;
  heading: string;
  description: string;
};

export type ContactSectionContent = {
  eyebrow: string;
  heading: string;
  description: string;
};

export type CompanyDetailsContent = {
  brandName: string;
  tagline: string;
  email: string;
  phonePrimary: string;
  phoneSecondary: string;
  linkedinUrl: string;
  githubUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
};

export type SiteContent = {
  hero: HeroContent;
  services: ServiceContent[];
  products: ProductContent[];
  caseStudies: CaseStudyContent[];
  values: ValueContent[];
  faqs: FaqContent[];
  whySection: WhySectionContent;
  faqSection: FaqSectionContent;
  servicesSection: ServicesSectionContent;
  contactSection: ContactSectionContent;
  companyDetails: CompanyDetailsContent;
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
  values: [
    {
      title: 'Tailored Solutions',
      body: 'Every business is different. We take the time to understand your requirements and build solutions that align with your goals, processes, and future growth.',
    },
    {
      title: 'Quality Engineering',
      body: 'We follow modern development practices to create software that is secure, maintainable, and built with long-term reliability in mind.',
    },
    {
      title: 'Built to Scale',
      body: 'Our solutions are designed with flexibility and scalability, making it easier to adapt and grow as your business evolves.',
    },
    {
      title: 'Transparent Collaboration',
      body: 'We believe great results come from working together. Throughout every stage of the project, we keep communication open, provide regular updates, and value your feedback.',
    },
    {
      title: 'Ongoing Support',
      body: "Our commitment doesn't end at launch. We provide maintenance, improvements, and technical support to help keep your software running smoothly.",
    },
  ],
  faqs: [
    {
      question: 'Do you work with startups and small businesses?',
      answer:
        'Yes. We enjoy working with startups, entrepreneurs, and growing businesses to transform ideas into practical digital solutions.',
    },
    {
      question: 'Can you build software tailored to our business?',
      answer:
        'Absolutely. Every solution we build is designed around your unique requirements, workflows, and business objectives.',
    },
    {
      question: 'Do you provide website maintenance and support?',
      answer:
        'Yes. We offer ongoing maintenance, security updates, performance improvements, and technical support for websites and web applications.',
    },
    {
      question: 'Can you improve an existing application or website?',
      answer:
        'Yes. We can enhance existing systems by adding new features, improving performance, modernizing the user experience, or resolving technical issues.',
    },
    {
      question: 'What happens after the project is completed?',
      answer:
        "We're happy to continue supporting your software with maintenance, enhancements, and technical guidance whenever you need us.",
    },
  ],
  whySection: {
    eyebrow: 'Why Choose Gencolink',
    heading: 'A reliable partner for building modern software',
    description:
      'At Gencolink, we believe successful software is built on clear communication, thoughtful engineering, and a genuine understanding of your goals. We focus on delivering practical, scalable solutions while building long-term relationships based on trust and collaboration.',
  },
  faqSection: {
    eyebrow: 'Frequently Asked Questions',
    heading: 'Everything you might want to know',
  },
  servicesSection: {
    eyebrow: 'Our Services',
    heading: 'End-to-end engineering for modern businesses',
    description:
      'From strategy to scale, we help you build, integrate, and operate software that drives impact.',
  },
  contactSection: {
    eyebrow: "Let's Connect",
    heading: "Let's build something great together",
    description:
      "Whether you're starting a new project, exploring an idea, or looking to improve an existing system, we'd love to hear from you. Share your goals with us, and we'll get back to you within one business day.",
  },
  companyDetails: {
    brandName: 'Gencolink',
    tagline: 'Building software that supports growth, innovation, and lasting value.',
    email: 'hello@gencolink.com',
    phonePrimary: '+94 71 4 280 380',
    phoneSecondary: '+94 77 5 690 380',
    linkedinUrl: 'https://www.linkedin.com',
    githubUrl: 'https://github.com',
    facebookUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
  },
};

@Injectable({ providedIn: 'root' })
export class SiteContentService {
  readonly content = signal<SiteContent>(defaultContent);
  readonly hero = computed(() => this.content().hero);
  readonly services = computed(() => this.content().services);
  readonly products = computed(() => this.content().products);
  readonly caseStudies = computed(() => this.content().caseStudies);
  readonly values = computed(() => this.content().values);
  readonly faqs = computed(() => this.content().faqs);
  readonly whySection = computed(() => this.content().whySection);
  readonly faqSection = computed(() => this.content().faqSection);
  readonly servicesSection = computed(() => this.content().servicesSection);
  readonly contactSection = computed(() => this.content().contactSection);
  readonly companyDetails = computed(() => this.content().companyDetails);

  async load(): Promise<void> {
    const base = this.getBaseUrl();
    if (!base) return;

    try {
      const [svcRes, prdRes, valRes, faqRes, whySecRes, faqSecRes, svcSecRes, contactSecRes, companyRes] =
        await Promise.all([
          fetch(`${base}/items/services?sort=sort&filter[status][_eq]=published`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/products?sort=sort&filter[status][_eq]=published`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/values?sort=sort&filter[status][_eq]=published`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/faqs?sort=sort&filter[status][_eq]=published`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/why_section`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/faq_section`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/services_section`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/contact_section`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
          fetch(`${base}/items/company_details`, { cache: 'no-store', headers: { Accept: 'application/json' } }),
        ]);

      if (
        !svcRes.ok ||
        !prdRes.ok ||
        !valRes.ok ||
        !faqRes.ok ||
        !whySecRes.ok ||
        !faqSecRes.ok ||
        !svcSecRes.ok ||
        !contactSecRes.ok ||
        !companyRes.ok
      ) {
        throw new Error('CMS fetch failed');
      }

      const [svcData, prdData, valData, faqData, whySecData, faqSecData, svcSecData, contactSecData, companyData] =
        await Promise.all([
          svcRes.json() as Promise<{ data: Record<string, unknown>[] }>,
          prdRes.json() as Promise<{ data: Record<string, unknown>[] }>,
          valRes.json() as Promise<{ data: Record<string, unknown>[] }>,
          faqRes.json() as Promise<{ data: Record<string, unknown>[] }>,
          whySecRes.json() as Promise<{ data: Record<string, unknown> | null }>,
          faqSecRes.json() as Promise<{ data: Record<string, unknown> | null }>,
          svcSecRes.json() as Promise<{ data: Record<string, unknown> | null }>,
          contactSecRes.json() as Promise<{ data: Record<string, unknown> | null }>,
          companyRes.json() as Promise<{ data: Record<string, unknown> | null }>,
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

      const values: ValueContent[] = valData.data?.length
        ? valData.data.map((r) => ({
            title: r['title'] as string,
            body: r['body'] as string,
          }))
        : defaultContent.values;

      const faqs: FaqContent[] = faqData.data?.length
        ? faqData.data.map((r) => ({
            question: r['question'] as string,
            answer: r['answer'] as string,
          }))
        : defaultContent.faqs;

      const whySection: WhySectionContent = whySecData.data?.['heading']
        ? {
            eyebrow: whySecData.data['eyebrow'] as string,
            heading: whySecData.data['heading'] as string,
            description: whySecData.data['description'] as string,
          }
        : defaultContent.whySection;

      const faqSection: FaqSectionContent = faqSecData.data?.['heading']
        ? {
            eyebrow: faqSecData.data['eyebrow'] as string,
            heading: faqSecData.data['heading'] as string,
          }
        : defaultContent.faqSection;

      const servicesSection: ServicesSectionContent = svcSecData.data?.['heading']
        ? {
            eyebrow: svcSecData.data['eyebrow'] as string,
            heading: svcSecData.data['heading'] as string,
            description: svcSecData.data['description'] as string,
          }
        : defaultContent.servicesSection;

      const contactSection: ContactSectionContent = contactSecData.data?.['heading']
        ? {
            eyebrow: contactSecData.data['eyebrow'] as string,
            heading: contactSecData.data['heading'] as string,
            description: contactSecData.data['description'] as string,
          }
        : defaultContent.contactSection;

      const companyDetails: CompanyDetailsContent = companyData.data?.['brandName']
        ? {
            brandName: companyData.data['brandName'] as string,
            tagline: companyData.data['tagline'] as string,
            email: companyData.data['email'] as string,
            phonePrimary: companyData.data['phonePrimary'] as string,
            phoneSecondary: companyData.data['phoneSecondary'] as string,
            linkedinUrl: companyData.data['linkedinUrl'] as string,
            githubUrl: companyData.data['githubUrl'] as string,
            facebookUrl: (companyData.data['facebookUrl'] as string) ?? '',
            instagramUrl: (companyData.data['instagramUrl'] as string) ?? '',
            tiktokUrl: (companyData.data['tiktokUrl'] as string) ?? '',
          }
        : defaultContent.companyDetails;

      this.content.update((c) => ({
        ...c,
        services,
        products,
        values,
        faqs,
        whySection,
        faqSection,
        servicesSection,
        contactSection,
        companyDetails,
      }));
    } catch {
      // Directus unreachable — keep default content already in signal
    }
  }

  private getBaseUrl(): string | null {
    const url = (globalThis as { __DIRECTUS_URL__?: string }).__DIRECTUS_URL__;
    return url ? url.replace(/\/$/, '') : null;
  }
}
