import { chromium } from 'playwright';

async function testAllScenarios() {
  const browser = await chromium.launch({ headless: true });
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
    ws.on('framereceived', (frame) => {
      try {
        const data = JSON.parse(frame.payload);
        if (data.type === 'event' || data.type === 'subscribe') {
          wsMessages.push({ dir: 'received', payload: frame.payload });
        }
      } catch {}
    });
    ws.on('framesent', (frame) => {
      try {
        const data = JSON.parse(frame.payload);
        if (data.type === 'subscribe') {
          wsMessages.push({ dir: 'sent', payload: frame.payload });
        }
      } catch {}
    });
  });

  await page.goto('http://localhost:5174');
  await page.waitForTimeout(2000);

  const scenarios = [
    { id: 'happy_path', label: 'Happy Path', tab: 'User Timeline' },
    { id: 'bank_b_silent', label: 'Bank B Silent', tab: 'User Timeline' },
    { id: 'disputed_case', label: 'Disputed State', tab: 'User Timeline' },
  ];

  for (const scenario of scenarios) {
    console.log('\n=== Testing ' + scenario.label + ' on ' + scenario.tab + ' ===');
    
    // Click scenario button
    await page.click('button[role="radio"]:has-text("' + scenario.label + '")');
    await page.waitForTimeout(3000);

    // Check timeline content
    const timelineText = await page.locator('main').innerText();
    console.log('Timeline contains:', timelineText.slice(0, 500));
  }

  // Test Merchant POS tab
  console.log('\n=== Testing Merchant POS tab ===');
  await page.click('button[role="tab"]:has-text("Merchant POS")');
  await page.waitForTimeout(1000);
  
  for (const scenario of scenarios) {
    console.log('\n--- ' + scenario.label + ' on Merchant POS ---');
    await page.click('button[role="radio"]:has-text("' + scenario.label + '")');
    await page.waitForTimeout(2000);
    const merchantText = await page.locator('main').innerText();
    console.log('Merchant text:', merchantText.slice(0, 500));
  }

  // Test Regulator tab
  console.log('\n=== Testing Regulator Audit tab ===');
  await page.click('button[role="tab"]:has-text("Regulator Audit")');
  await page.waitForTimeout(1000);
  
  for (const scenario of scenarios) {
    console.log('\n--- ' + scenario.label + ' on Regulator Audit ---');
    await page.click('button[role="radio"]:has-text("' + scenario.label + '")');
    await page.waitForTimeout(2000);
    const regulatorText = await page.locator('main').innerText();
    console.log('Regulator text:', regulatorText.slice(0, 500));
  }

  console.log('\n=== SUMMARY ===');
  console.log('Console errors:', consoleLogs.filter(l => l.type === 'error' || l.type === 'pageerror'));
  console.log('Failed requests:', failedRequests);
  console.log('WS subscribes:', wsMessages.filter(m => m.dir === 'sent').map(m => m.payload));

  await browser.close();
}

testAllScenarios().catch(console.error);