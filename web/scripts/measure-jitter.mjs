import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function measureView(page, viewName, tabSelector, triggerAction) {
  console.log(`\n==============================================`);
  console.log(`MEASURING VIEW: ${viewName}`);
  console.log(`==============================================`);

  // Navigate or click tab
  if (tabSelector) {
    await page.click(tabSelector);
    await page.waitForTimeout(800);
  }

  // Reset metrics
  await page.evaluate(() => {
    window.__clsEntries = [];
    window.__totalCLS = 0;
    window.__longTasks = 0;

    if (!window.__clsObserver) {
      window.__clsObserver = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            window.__totalCLS += entry.value;
            const sources = entry.sources ? entry.sources.map(s => ({
              node: s.node ? (s.node.nodeName + (s.node.className ? '.' + s.node.className.split(' ').slice(0, 2).join('.') : '')) : 'unknown',
              previousRect: s.previousRect,
              currentRect: s.currentRect
            })) : [];
            window.__clsEntries.push({ value: entry.value, sources });
          }
        }
      });
      window.__clsObserver.observe({ type: 'layout-shift', buffered: true });
    }

    if (!window.__longTaskObserver && window.PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      window.__longTaskObserver = new PerformanceObserver((entryList) => {
        window.__longTasks += entryList.getEntries().length;
      });
      window.__longTaskObserver.observe({ type: 'longtask', buffered: true });
    }
  });

  // 1. Idle observation (5 seconds sample)
  console.log(`Sampling idle state for 5s...`);
  const idleFrames = [];
  const startIdle = Date.now();
  while (Date.now() - startIdle < 3000) {
    const screenshot = await page.screenshot();
    idleFrames.push(screenshot);
    await page.waitForTimeout(100);
  }

  // Calculate idle pixel diffs
  let idleDiffCount = 0;
  for (let i = 1; i < idleFrames.length; i++) {
    const prev = idleFrames[i - 1];
    const curr = idleFrames[i];
    if (!prev.equals(curr)) {
      idleDiffCount++;
    }
  }

  const idleCLS = await page.evaluate(() => window.__totalCLS);
  console.log(`Idle Sample: ${idleFrames.length} frames, ${idleDiffCount} diffs (${((idleDiffCount / (idleFrames.length - 1)) * 100).toFixed(1)}% repainting), CLS=${idleCLS.toFixed(4)}`);

  // 2. Activity / Event stimulation
  console.log(`Triggering active scenario transitions & events...`);
  const activityFrames = [];
  const activityStart = Date.now();

  const activityPromise = (async () => {
    while (Date.now() - activityStart < 5000) {
      const shot = await page.screenshot();
      activityFrames.push(shot);
      await page.waitForTimeout(100);
    }
  })();

  if (triggerAction) {
    await triggerAction(page);
  }

  await activityPromise;

  // Calculate activity pixel diffs
  let actDiffCount = 0;
  for (let i = 1; i < activityFrames.length; i++) {
    if (!activityFrames[i - 1].equals(activityFrames[i])) {
      actDiffCount++;
    }
  }

  // Gather final stats
  const result = await page.evaluate(() => ({
    totalCLS: window.__totalCLS,
    clsEntries: window.__clsEntries,
    longTasks: window.__longTasks,
  }));

  result.idleDiffRate = (idleDiffCount / Math.max(1, idleFrames.length - 1));
  result.actDiffRate = (actDiffCount / Math.max(1, activityFrames.length - 1));

  console.log(`Final Total CLS: ${result.totalCLS.toFixed(5)}`);
  console.log(`Long Tasks: ${result.longTasks}`);
  console.log(`Shift Entries Count: ${result.clsEntries.length}`);
  if (result.clsEntries.length > 0) {
    console.log(`Top Shift Sources:`);
    result.clsEntries.forEach((e, idx) => {
      console.log(`  #${idx + 1} Shift=${e.value.toFixed(5)}:`, JSON.stringify(e.sources.map(s => s.node)));
    });
  }

  return result;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // 1. Measure Timeline View
  const timelineResult = await measureView(page, 'User Timeline', null, async (p) => {
    // Click scenario buttons repeatedly to test rapid transitions
    for (let i = 0; i < 6; i++) {
      await p.click('button[role="radio"]:has-text("Bank B Silent")');
      await p.waitForTimeout(400);
      await p.click('button[role="radio"]:has-text("Disputed State")');
      await p.waitForTimeout(400);
      await p.click('button[role="radio"]:has-text("Happy Path")');
      await p.waitForTimeout(400);
    }
  });

  // 2. Measure Merchant POS View
  const merchantResult = await measureView(page, 'Merchant POS', 'button[role="tab"]:has-text("Merchant POS")', async (p) => {
    for (let i = 0; i < 6; i++) {
      await p.click('button[role="radio"]:has-text("Bank B Silent")');
      await p.waitForTimeout(400);
      await p.click('button[role="radio"]:has-text("Disputed State")');
      await p.waitForTimeout(400);
      await p.click('button[role="radio"]:has-text("Happy Path")');
      await p.waitForTimeout(400);
    }
  });

  await browser.close();

  console.log(`\n==============================================`);
  console.log(`SUMMARY REPORT`);
  console.log(`==============================================`);
  console.log(`User Timeline View CLS: ${timelineResult.totalCLS.toFixed(5)} | Idle Repaint Diff Rate: ${(timelineResult.idleDiffRate * 100).toFixed(1)}%`);
  console.log(`Merchant POS View CLS:  ${merchantResult.totalCLS.toFixed(5)} | Idle Repaint Diff Rate: ${(merchantResult.idleDiffRate * 100).toFixed(1)}%`);

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'jitter-report.json'),
    JSON.stringify({ timeline: timelineResult, merchant: merchantResult }, null, 2)
  );
}

run().catch(console.error);
