import { test, expect } from './fixtures';

test('P8 shell: 15 primary destinations, footer links, unclipped search @mobile', async ({ page }) => {
  await page.goto('/');
  if (test.info().project.name === 'desktop') await expect(page.getByRole('navigation',{name:'Primary'}).getByRole('link')).toHaveCount(15);
  else {
    await expect(page.getByRole('navigation',{name:'Quick navigation'})).toBeVisible();
    const menu=page.getByRole('dialog',{name:'Menu'});
    // A tap before hydration has no handler yet (slow on a cold dev server): tap until the menu answers.
    await expect(async () => {
      if (!(await menu.isVisible())) await page.getByRole('button',{name:'Open menu'}).click();
      await expect(menu.getByRole('link',{name:'Coverage'})).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 20_000 });
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
  }
  // Desktop: the header's search; phones: the dock's Search (the header one is hidden at phone width).
  const phone = test.info().project.name === 'phone';
  await page.getByRole('button', phone ? { name: 'Search', exact: true } : { name: 'Search tokens, wallets, entities, chains and sectors' }).click();
  const dialog=page.getByRole('dialog',{name:'Search',exact:true});
  await expect(dialog).toBeVisible();
  const rect=await dialog.boundingBox();
  expect(rect!.height).toBeGreaterThan(100);
  const box = page.getByRole('combobox', { name: 'Search Peregrine' });
  await box.fill('base');
  await expect(dialog.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(box).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('P8 materials: cards have no blur; reduced motion and transparency supported', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.goto('/');
  expect(await page.locator('section.material').first().evaluate(el=>getComputedStyle(el).backdropFilter)).toBe('none');
  // The live dot shows only while the newest reading is fresh (recorded demo data is not): check it when present.
  const dot = page.locator('.live-dot').first();
  if (await dot.count()) expect(await dot.evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('section.material').first().evaluate(el=>getComputedStyle(el).animationName)).toBe('none');
  await page.getByRole('button',{name:'Switch to paper chart theme'}).click();
  expect(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundImage)).toBe('none');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('P8 screenshot sweep', async ({page}, info) => {
  test.skip(process.env.P8_VISUALS !== '1','Opt-in full visual archive');
  test.setTimeout(600_000);
  const routes=[['radar','/'],['flows','/flows'],['token','/token/base/0x940181a94a35a4569e4529a3cdfb74e38fd98631'],['chain','/chain/base'],['perps','/perps'],['alpha','/alpha'],['sectors','/sectors'],['predictions','/predict'],['smart-money','/smart-money'],['portfolio','/portfolio'],['desk','/desk'],['trade','/trade'],['alerts','/alerts'],['lab','/lab'],['account','/account'],['coverage','/coverage'],['ask','/agent'],['wallet','/wallet/0xcbb811f129782ef87e19dea9d3375045219bae00'],['replay','/replay/base/0x9b5e262cf9bb04869ab40b19af91d2dc85761722']];
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]) for(const theme of ['navy','paper']) {
    await page.setViewportSize({width,height:width===390?844:1000});
    await page.addInitScript(t=>localStorage.setItem('tide-theme',t),theme);
    for(const [name,path] of routes) {
      await page.goto(path);
      await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();
      if(name==='token') await expect(page.getByText(/This page: \d+ Nansen calls/)).toBeVisible({timeout:60000});
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForTimeout(600);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${width} ${theme} overflow`).toBe(true);
      await page.screenshot({path:`test-results/p8/P8-${name}-${width}-${theme==='navy'?'dark':'light'}.png`});
      expect(errors,`${name} runtime errors`).toEqual([]);
    }
  }
  await info.attach('screenshots',{body:'Saved 76 route/theme/viewport screenshots to test-results/p8/P8-*.png',contentType:'text/plain'});
});
