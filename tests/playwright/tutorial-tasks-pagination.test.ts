/// <reference lib="dom" />
import { expect, test } from '@playwright/test';

const entry = process.env.APP_URL;
if (!entry)
  throw new Error('Set APP_URL to the application entry printed by pnpm dev.');
const appUrl = new URL(entry.endsWith('/') ? entry : `${entry}/`);
const apiUrl = (path: string) => new URL(`api/${path}`, appUrl).href;
test.use({
  viewport: { width: 1440, height: 960 },
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        args: ['--no-sandbox'],
      }
    : {},
});

test('preserves filters and paging across overlays, reload, history and completion', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(appUrl.href);
  await page
    .getByLabel('Username or email', { exact: true })
    .fill(process.env.TUTORIAL_USERNAME ?? 'nocobase');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.TUTORIAL_PASSWORD ?? 'admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).waitFor();
  const prefix = `Paging ${Date.now()}`;
  const headers = { origin: appUrl.origin };
  for (let i = 0; i < 11; i++) {
    const response = await page.request.post(apiUrl('tutorialTasks'), {
      headers,
      data: { title: `${prefix} ${i}` },
    });
    expect(response.status()).toBe(201);
  }
  await page.goto(
    new URL(`tasks?q=${encodeURIComponent(prefix)}&status=pending`, appUrl)
      .href,
  );
  const rows = page.locator('tbody tr');
  const search = page.getByRole('textbox', {
    name: 'Search by title',
    exact: true,
  });
  await expect(rows).toHaveCount(10);
  await page
    .getByRole('button', { name: 'Go to next page', exact: true })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(rows).toHaveCount(1);
  const secondPageUrl = page.url();
  await page.reload();
  await expect(search).toHaveValue(prefix);
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await expect(page).toHaveURL(/tasks\/create\?q=/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(secondPageUrl);
  await page
    .getByRole('button', { name: 'Go to previous page', exact: true })
    .click();
  await expect(rows).toHaveCount(10);
  await page.goBack();
  await expect(page).toHaveURL(secondPageUrl);
  await expect(rows).toHaveCount(1);
  await rows.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(page).toHaveURL(/page=1/);
  await expect(rows).toHaveCount(10);
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }).locator('span'),
  ).toBeFocused();
  await page.getByRole('combobox', { name: 'Status', exact: true }).click();
  await page.getByRole('option', { name: 'Completed', exact: true }).click();
  await expect(rows).toHaveCount(1);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await search.fill('no-such-task-' + prefix);
  await expect(
    page.getByText('No tasks match your filters.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page
    .getByRole('textbox', { name: /Title/ })
    .fill('Not part of the current filter ' + Date.now());
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('No tasks match your filters.', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Clear filters', exact: true })
    .first()
    .click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await search.pressSequentially(prefix);
  await expect
    .poll(() => new URL(page.url()).searchParams.get('q'))
    .toBe(prefix);
  await expect(rows).toHaveCount(10);
  await page
    .getByRole('combobox', { name: 'Rows per page', exact: true })
    .click();
  await page.getByRole('option', { name: '20', exact: true }).click();
  await expect(rows).toHaveCount(11);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 960 });
    for (const dark of [false, true]) {
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle('dark', dark),
        dark,
      );
      await expect(search).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `storage/ui-workflow/pagination/${width}-${dark}.png`,
        animations: 'disabled',
      });
    }
  }
  expect(errors).toEqual([]);
});
