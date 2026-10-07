import { chromium } from 'playwright';
import fs from 'fs';

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);

  const tabBtn = page.locator('button[role="tab"]:has-text("Merchant POS")');
  await tabBtn.click();
  await page.waitForTimeout(1000);

  const frame1 = await page.screenshot();
  await page.waitForTimeout(500);
  const frame2 = await page.screenshot();

  console.log('Frames match directly:', frame1.equals(frame2));
  if (!frame1.equals(frame2)) {
    fs.writeFileSync('scripts/frame1.png', frame1);
    fs.writeFileSync('scripts/frame2.png', frame2);
    console.log('Wrote frame1.png and frame2.png');
  }

  await browser.close();
}

debug().catch(console.error);
