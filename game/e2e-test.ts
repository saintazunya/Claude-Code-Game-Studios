// Quick E2E test to debug event popup button clickability
import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  // Start dev server manually, then navigate
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(1000);

  // Title screen → click 开始新游戏
  console.log('1. Title screen');
  const newGameBtn = page.getByText('开始新游戏');
  await newGameBtn.click();
  await page.waitForTimeout(500);

  // Character creation → click 确认出发
  console.log('2. Character creation');
  const confirmBtn = page.getByText('确认出发');
  await confirmBtn.click();
  await page.waitForTimeout(500);

  // Main game → select work mode and end turn repeatedly until event shows
  let eventFound = false;
  for (let turn = 0; turn < 20; turn++) {
    console.log(`3. Turn ${turn + 1}`);

    // Check if we're on event screen
    const eventHeader = await page.locator('text=选择你的应对方式').count();
    if (eventHeader > 0) {
      console.log('EVENT FOUND! Trying to click first choice...');
      eventFound = true;

      // Log all buttons on the page
      const buttons = await page.locator('button').all();
      console.log(`Found ${buttons.length} buttons`);
      for (let i = 0; i < buttons.length; i++) {
        const text = await buttons[i].textContent();
        const box = await buttons[i].boundingBox();
        const visible = await buttons[i].isVisible();
        const enabled = await buttons[i].isEnabled();
        console.log(`  Button ${i}: "${text?.slice(0, 50)}" visible=${visible} enabled=${enabled} box=${JSON.stringify(box)}`);
      }

      // Try to click the first choice button
      const choiceButtons = await page.locator('.p-5 button').all();
      console.log(`Found ${choiceButtons.length} choice buttons in .p-5`);

      if (choiceButtons.length > 0) {
        try {
          await choiceButtons[0].click({ timeout: 3000 });
          console.log('CLICK SUCCEEDED!');
        } catch (e: any) {
          console.log(`CLICK FAILED: ${e.message}`);

          // Try force click
          try {
            await choiceButtons[0].click({ force: true, timeout: 3000 });
            console.log('FORCE CLICK SUCCEEDED!');
          } catch (e2: any) {
            console.log(`FORCE CLICK ALSO FAILED: ${e2.message}`);
          }
        }
      }

      // Take screenshot
      await page.screenshot({ path: '/tmp/event-popup.png' });
      console.log('Screenshot saved to /tmp/event-popup.png');

      // Check the HTML structure
      const html = await page.locator('.p-5').first().innerHTML();
      console.log('Choice section HTML:', html.slice(0, 500));

      break;
    }

    // Check if we're on summary screen
    const continueBtn = await page.locator('text=下一季度').count();
    if (continueBtn > 0) {
      await page.getByText('下一季度').click();
      await page.waitForTimeout(300);
      continue;
    }

    // Main game: select normal work mode
    const normalBtn = await page.locator('text=正常').first();
    if (await normalBtn.count() > 0) {
      await normalBtn.click();
      await page.waitForTimeout(200);
    }

    // Click 结束本季度
    const endTurnBtn = await page.locator('text=结束本季度').first();
    if (await endTurnBtn.count() > 0 && await endTurnBtn.isEnabled()) {
      await endTurnBtn.click();
      await page.waitForTimeout(500);
    }
  }

  if (!eventFound) {
    console.log('No event appeared in 20 turns');
    await page.screenshot({ path: '/tmp/no-event.png' });
  }

  await browser.close();
}

test().catch(console.error);
