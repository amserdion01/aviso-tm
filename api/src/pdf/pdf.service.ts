import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';

/**
 * Render an HTML string to an A4 PDF via headless Chromium (Puppeteer).
 * The browser is launched per request — simple and stateless, fine for a demo
 * (~1s per document); a shared long-lived instance is the obvious optimization
 * if it ever matters.
 */
@Injectable()
export class PdfService {
  async htmlToPdf(html: string): Promise<Uint8Array> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
      });
    } finally {
      await browser.close();
    }
  }
}
