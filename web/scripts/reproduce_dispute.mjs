import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('web/scripts/reproduce_output');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function runTest(viewName, tabSelector) {
  console.log(`\n========================================`);
  console.log(`Testing view: ${viewName}`);
  console.log(`========================================`);

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleLogs = [];
  const wsMessages = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (err) => {
    consoleLogs.push({ type: 'pageerror', text: err.message });
  });

  page.on('requestfailed', (req) => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  page.on('websocket', (ws) => {
    console.log(`[WS Connected] ${ws.url()}`);
    ws.on('framesent', (frame) => {
      wsMessages.push({ dir: 'sent', payload: frame.payload });
    });
    ws.on('framereceived', (frame) => {
      wsMessages.push({ dir: 'received', payload: frame.payload });
    });
  });

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(1000);

  // Switch to tab if specified
  if (tabSelector) {
    await page.click(tabSelector);
    await page.waitForTimeout(500);
  }

  // Find Disputed State radio/button
  console.log('Clicking Disputed State scenario button...');
  const disputedBtn = page.locator('button[role="radio"]:has-text("Disputed State")');
  await disputedBtn.click();

  // Screenshot at 0s
  await page.screenshot({ path: path.join(outDir, `${viewName}_0s.png`) });
  console.log(`Captured screenshot at 0s`);

  // Wait to 2s
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(outDir, `${viewName}_2s.png`) });
  console.log(`Captured screenshot at 2s`);

  // Wait to 5s (3s more)
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, `${viewName}_5s.png`) });
  console.log(`Captured screenshot at 5s`);

  // Wait to 10s (5s more)
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(outDir, `${viewName}_10s.png`) });
  console.log(`Captured screenshot at 10s`);

  // Capture text content of the status card / timeline
  const pageContentSummary = await page.evaluate(() => {
    const mainText = document.querySelector('main')?.innerText;
    return mainText;
  });

  await browser.close();

  const report = {
    viewName,
    wsMessages,
    consoleLogs,
    failedRequests,
    pageContentSummary,
  };

  fs.writeFileSync(path.join(outDir, `${viewName}_report.json`), JSON.stringify(report, null, 2));
  console.log(`WS messages count: ${wsMessages.length}`);
  console.log('WS messages:', wsMessages);
  console.log('Console logs:', consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror'));
  console.log('Failed requests:', failedRequests);
}

async function main() {
  // Test Merchant POS tab
  await runTest('merchant_pos', 'button:has-text("Merchant POS")');
  // Test User Timeline tab
  await runTest('user_timeline', 'button:has-text("User Timeline")');
}

main().catch(console.error);
