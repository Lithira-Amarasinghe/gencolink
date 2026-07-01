import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4300', { waitUntil: 'load' });
await page.screenshot({ path: 'qa-desktop.png', fullPage: true });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto('http://127.0.0.1:4300', { waitUntil: 'load' });
await page.screenshot({ path: 'qa-mobile.png', fullPage: true });
const metrics = await page.evaluate(() => ({
  width: innerWidth,
  height: innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  hero: document.querySelector('h1')?.textContent?.trim(),
  imageCount: document.images.length,
  incompleteImages: Array.from(document.images).filter((image) => !image.complete || !image.naturalWidth).length,
}));
console.log(JSON.stringify(metrics, null, 2));
await browser.close();
