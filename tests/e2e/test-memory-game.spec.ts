import { test, expect } from '@playwright/test';
test('Memory Game Cards Visible', async ({ page }) => {
  await page.goto('http://localhost:8080/iframe-runner.html?project=projects/MemoryGame.json');
  await page.waitForTimeout(4000);
  const objects = await page.locator('.game-object').all();
  console.log('Total game-objects:', objects.length);
  if (objects.length === 0) {
      console.log(await page.content());
  }
  for (const obj of objects) {
    const id = await obj.getAttribute('data-id');
    const display = await obj.evaluate((el: HTMLElement) => window.getComputedStyle(el).display);
    const text = await obj.innerText();
    const className = await obj.getAttribute('class');
    if (className && className.includes('TButton')) {
        console.log(`Card: id=${id}, display=${display}, text=${text}`);
    }
  }
});
