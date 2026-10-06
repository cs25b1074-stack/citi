import fs from 'fs';

// Simple PNG pixel comparison or chunk comparison
const f1 = fs.readFileSync('scripts/frame1.png');
const f2 = fs.readFileSync('scripts/frame2.png');

console.log('Size f1:', f1.length, 'Size f2:', f2.length);

// Let's decode or inspect with Jimp or canvas if available, or just check what elements are in browser:
import { chromium } from 'playwright';

async function checkElements() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  await page.click('button[role="tab"]:has-text("Merchant POS")');
  await page.waitForTimeout(1000);

  // Check every element on page for changes across 500ms
  const diffs = await page.evaluate(async () => {
    function snapshot() {
      const els = Array.from(document.querySelectorAll('*'));
      return els.map(el => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          className: el.className,
          text: el.textContent?.trim().slice(0, 30),
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        };
      });
    }

    const s1 = snapshot();
    await new Promise(r => setTimeout(r, 600));
    const s2 = snapshot();

    const changed = [];
    for (let i = 0; i < s1.length; i++) {
      if (s1[i].text !== s2[i].text) {
        changed.push({ type: 'text', el: s1[i], newText: s2[i].text });
      }
      if (JSON.stringify(s1[i].rect) !== JSON.stringify(s2[i].rect)) {
        changed.push({ type: 'rect', el: s1[i], newRect: s2[i].rect });
      }
    }
    return changed;
  });

  console.log('DOM changes during 600ms:', JSON.stringify(diffs, null, 2));
  await browser.close();
}

checkElements().catch(console.error);
