/// <reference lib="dom" />
import { test, expect } from '@playwright/test';

const entry = process.env.APP_URL;
if (!entry) throw new Error('Set APP_URL to the full application entry URL.');
const appUrl = new URL(entry.endsWith('/') ? entry : `${entry}/`);
const taskApi = new URL('api/tutorialTasks', appUrl).href;

test.use({
  actionTimeout: 15000,
  timezoneId: 'America/Los_Angeles',
  viewport: { width: 1440, height: 960 },
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        args: ['--no-sandbox'],
      }
    : {},
});

test('creates calendar dates, keeps them after reload and completion, and localizes the form', async ({
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
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const title = `Review release ${Date.now()}`;
  await page
    .getByRole('dialog', { name: 'New task', exact: true })
    .getByRole('textbox', { name: 'Title', exact: false })
    .fill(title);
  const date = page.getByLabel('Due date', { exact: true });
  await date.click();
  // Select a visible day through the real calendar; use the local browser date.
  const expectedDate = await page.evaluate(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`;
  });
  await page
    .getByRole('gridcell')
    .filter({ has: page.getByRole('button', { name: /15/ }) })
    .getByRole('button')
    .click();
  await expect(date).toBeFocused();
  await date.click();
  await page.getByRole('button', { name: 'Clear date', exact: true }).click();
  await expect(date).toHaveText('No due date');
  await date.click();
  await page
    .getByRole('gridcell')
    .filter({ has: page.getByRole('button', { name: /15/ }) })
    .getByRole('button')
    .click();
  // Change one outbound payload to reach real server validation; no response is mocked.
  await page.route(taskApi, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      await route.continue({
        postData: JSON.stringify({ ...payload, dueDate: '2026-02-30' }),
      });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#tutorial-task-due-date-error')).toHaveText(
    'Choose a valid date.',
  );
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await expect(date).toHaveAttribute(
    'aria-describedby',
    'tutorial-task-due-date-error',
  );
  await expect(date).toBeFocused();
  await expect(
    page
      .getByRole('dialog', { name: 'New task' })
      .getByRole('textbox', { name: 'Title' }),
  ).toHaveValue(title);
  await page.unroute(taskApi);
  const responsePromise = page.waitForResponse(
    (r) => r.url() === taskApi && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const created = await responsePromise;
  expect(created.status()).toBe(201);
  expect((await created.json()).data.dueDate).toBe(expectedDate);
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row.locator('time')).toHaveText(expectedDate);
  await row.getByRole('button', { name: 'Complete', exact: true }).click();
  await page.reload();
  await expect(row.getByText('Completed', { exact: true })).toBeVisible();
  await expect(row.locator('time')).toHaveText(expectedDate);
  await row.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(row.getByText('Pending', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: /Language/ }).click();
  await page.getByRole('menuitemradio', { name: /中文/ }).click();
  await expect(
    page.getByRole('columnheader', { name: '截止日期', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: 'storage/ui-workflow/tasks-update/screenshots/list-zh.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  await page
    .getByRole('dialog', { name: '新建任务' })
    .getByRole('textbox', { name: '标题' })
    .fill('上线前检查任务');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 960 });
    for (const dark of [false, true]) {
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle('dark', dark),
        dark,
      );
      await page.getByLabel('截止日期', { exact: true }).click();
      await expect(page.getByRole('grid')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `storage/ui-workflow/tasks-update/screenshots/create-zh-${width}-${dark ? 'dark' : 'light'}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      await page.keyboard.press('Escape');
      await expect(page.getByLabel('截止日期', { exact: true })).toBeFocused();
      await expect(
        page.getByRole('dialog', { name: '新建任务' }),
      ).toBeVisible();
    }
  }
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(errors).toEqual([]);
});
