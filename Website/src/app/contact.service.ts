import { Injectable } from '@angular/core';

export interface ContactPayload {
  name: string;
  email: string;
  company: string;
  message: string;
}

const globals = globalThis as {
  __DIRECTUS_URL__?: string;
  __CONTACT_FUNCTION_URL__?: string;
};

@Injectable({ providedIn: 'root' })
export class ContactService {
  async submit(payload: ContactPayload): Promise<void> {
    const directusBase = globals.__DIRECTUS_URL__?.replace(/\/$/, '');
    const functionUrl = globals.__CONTACT_FUNCTION_URL__;

    if (directusBase) {
      await this.submitViaDirectus(directusBase, payload);
    } else if (functionUrl) {
      await this.submitViaFunction(functionUrl, payload);
    } else {
      throw new Error('No submission endpoint configured.');
    }
  }

  private async submitViaDirectus(base: string, payload: ContactPayload): Promise<void> {
    const res = await fetch(`${base}/items/contact_submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`Submission failed (${res.status}): ${detail}`);
    }
  }

  private async submitViaFunction(url: string, payload: ContactPayload): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`Submission failed (${res.status}): ${detail}`);
    }
  }
}
