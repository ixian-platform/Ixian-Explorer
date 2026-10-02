import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/* Smoke tests on the static export with the demo data. The demo chain is seeded but its tip
   moves with the clock, so values are read from the pages rather than written in here. */

async function prepare(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/WebGL|GPU|three/i.test(m.text())) errors.push(m.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // the privacy notice has been seen, so it doesn't cover the page
  await page.addInitScript(() => window.localStorage.setItem('ixs-notice', JSON.stringify({ v: 1, at: Date.now() })));
  return errors;
}

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
}

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

/** A link on the home page matching `prefix`, read from the live feeds. */
async function firstHref(page: Page, prefix: string) {
  await page.goto('/');
  const link = page.locator(`a[href^="${prefix}"]`).first();
  await expect(link).toBeVisible();
  return (await link.getAttribute('href'))!;
}

for (const path of ['/', '/blocks', '/network', '/stats', '/ixi', '/search']) {
  test(`page ${path} renders, no errors, accessible`, async ({ page }) => {
    const errors = await prepare(page);
    await page.goto(path);
    await expect(page.locator('main').first()).toBeVisible();
    await page.waitForTimeout(800);
    await noOverflow(page);
    await axe(page);
    expect(errors).toEqual([]);
  });
}

test('block, transaction and address pages open from the feeds', async ({ page }) => {
  const errors = await prepare(page);
  const block = await firstHref(page, '/block?h=');
  await page.goto(block);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('#');
  await axe(page);

  const tx = await firstHref(page, '/tx?id=');
  await page.goto(tx);
  const addr = page.locator('a[href^="/address?a="]').first();
  await expect(addr).toBeVisible();
  await addr.click();
  await expect(page).toHaveURL(/\/address\?a=/);
  await expect(page.getByText('checksum valid')).toBeVisible();
  await axe(page);
  expect(errors).toEqual([]);
});

test('search opens a block by height', async ({ page }) => {
  const errors = await prepare(page);
  const block = await firstHref(page, '/block?h=');
  const h = block.split('=')[1];
  await page.goto(`/search?q=${h}`);
  await expect(page).toHaveURL(new RegExp(`/block\\?h=${h}$`));
  expect(errors).toEqual([]);
});

test.describe('not found', () => {
  test('404: a near-miss page name is suggested', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/blok');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('on the chain.');
    await expect(page.getByRole('link', { name: /Did you mean Blocks/ })).toHaveAttribute('href', '/blocks');
    await noOverflow(page);
    await axe(page);
    // the page itself answers 404, which the browser logs; anything else is a real error
    expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
  });

  test('404: old explorer links and chain values in the path are sent on', async ({ page }) => {
    await prepare(page);
    await page.goto('/index.php?p=block&id=5');
    await expect(page).toHaveURL(/\/block\?h=5$/);
    await page.goto('/12345');
    await expect(page).toHaveURL(/\/block\?h=12345$/);
  });

  test('a block ahead of the chain counts down', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/block?h=999999999');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('isn’t here yet.');
    await expect(page.getByRole('group', { name: 'Time to this block' })).toBeVisible();
    await noOverflow(page);
    await axe(page);
    expect(errors).toEqual([]);
  });

  test('block 0 and an unknown hash are explained', async ({ page }) => {
    await prepare(page);
    await page.goto('/block?h=0');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('block 0.');
    await page.goto('/block?hash=abc');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('with this hash.');
    await expect(page.getByText('3 of 128 characters')).toBeVisible();
  });

  test('transactions: bad format, past the chain, no match', async ({ page }) => {
    const errors = await prepare(page);
    await page.goto('/tx?id=123-abc');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('a transaction ID.');

    await page.goto('/tx?id=999999999-4xpr5xhgoGXSefhnaWKiV4k961WFXgu85kLGsrrFAoav');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('past the chain.');

    // an old block's transaction with its last character changed: no match, link to its block
    const tx = decodeURIComponent((await firstHref(page, '/tx?id=')).split('=')[1]);
    const height = Number(tx.split('-')[0]) - 100;
    const bad = `${height}-${tx.split('-')[1].slice(0, -1)}${tx.endsWith('z') ? 'y' : 'z'}`;
    await page.goto(`/tx?id=${encodeURIComponent(bad)}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('with this ID.');
    await expect(page.getByRole('link', { name: new RegExp(`Open block #${height.toLocaleString('en')}`) })).toBeVisible();
    await axe(page);
    expect(errors).toEqual([]);
  });

  test('an address with one wrong character gets its fix', async ({ page }) => {
    const errors = await prepare(page);
    const tx = await firstHref(page, '/tx?id=');
    await page.goto(tx);
    const href = (await page.locator('a[href^="/address?a="]').first().getAttribute('href'))!;
    const good = decodeURIComponent(href.split('=')[1]);
    const typo = good.slice(0, -1) + (good.endsWith('z') ? 'y' : 'z');
    await page.goto(`/address?a=${typo}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('an Ixian address.');
    const fix = page.getByRole('link', { name: 'Open the fixed address' });
    await expect(fix).toBeVisible({ timeout: 20_000 });
    await expect(fix).toHaveAttribute('href', `/address?a=${encodeURIComponent(good)}`);
    await noOverflow(page);
    await axe(page);
    expect(errors).toEqual([]);
  });
});
