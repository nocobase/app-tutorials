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

test('selects a real assignee, persists it and recovers from a disabled selection', async ({
  page,
}) => {
  await page.goto(appUrl.href);
  await page
    .getByLabel('Username or email', { exact: true })
    .fill(process.env.TUTORIAL_USERNAME ?? 'nocobase');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.TUTORIAL_PASSWORD ?? 'admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).waitFor();
  const suffix = Date.now();
  const name = `Assignment member ${suffix}`;
  const headers = { origin: appUrl.origin };
  const created = await page.request.post(apiUrl('users'), {
    headers,
    data: {
      name,
      email: `assignment-${suffix}@example.test`,
      password: 'assignment-browser-test-password',
    },
  });
  expect(created.status()).toBe(201);
  const { data: user } = (await created.json()) as { data: { id: string } };
  try {
    await page.goto(new URL('tasks/create', appUrl).href);
    await page
      .getByRole('textbox', { name: /Title/ })
      .fill(`Assigned task ${suffix}`);
    const assignee = page.getByRole('combobox', {
      name: 'Assignee',
      exact: true,
    });
    await assignee.click();
    await page.getByRole('option', { name, exact: true }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    const row = page
      .getByRole('row')
      .filter({ hasText: `Assigned task ${suffix}` });
    await expect(row.getByText(name, { exact: true })).toBeVisible();
    await page.reload();
    await expect(row.getByText(name, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'New task', exact: true }).click();
    await page
      .getByRole('textbox', { name: /Title/ })
      .fill(`Retry assignment ${suffix}`);
    await assignee.click();
    await page.getByRole('option', { name, exact: true }).click();
    // The candidate becomes unavailable after it has been selected; no response is mocked.
    expect(
      (
        await page.request.post(apiUrl(`users/${user.id}/disable`), { headers })
      ).status(),
    ).toBe(200);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(
      page.getByText(
        'This user is unavailable. Choose another user or leave the task unassigned.',
      ),
    ).toBeVisible();
    await expect(assignee).toHaveAttribute('aria-invalid', 'true');
    await expect(assignee).toBeFocused();
    await expect(page.getByRole('textbox', { name: /Title/ })).toHaveValue(
      `Retry assignment ${suffix}`,
    );
    await assignee.click();
    await page.getByRole('option', { name: 'Unassigned', exact: true }).click();
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: `Retry assignment ${suffix}` })
        .getByText('Unassigned', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'New task', exact: true }).click();
    await assignee.click();
    await expect(
      page.getByRole('option', { name: 'Unassigned', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('option', { name, exact: true })).toHaveCount(
      0,
    );
    await page.keyboard.press('Escape');
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 844 });
      for (const dark of [false, true]) {
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle('dark', dark),
          dark,
        );
        const box = await page
          .getByRole('dialog', { name: 'New task', exact: true })
          .boundingBox();
        expect(box?.width).toBeLessThanOrEqual(width);
        await expect(
          page.getByRole('combobox', { name: 'Assignee', exact: true }),
        ).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Create', exact: true }),
        ).toBeInViewport();
        await page.screenshot({
          path: `storage/ui-workflow/assignment/en-${width}-${dark}.png`,
          animations: 'disabled',
        });
      }
    }
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.getByRole('button', { name: 'Open account menu' }).click();
    await page.getByRole('menuitem', { name: /Language/ }).click();
    await page.getByRole('menuitemradio', { name: /中文/ }).click();
    await page.getByRole('button', { name: '新建任务', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: '负责人', exact: true }),
    ).toBeVisible();
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 844 });
      for (const dark of [false, true]) {
        await page.evaluate(
          (dark) => document.documentElement.classList.toggle('dark', dark),
          dark,
        );
        await expect(
          page.getByRole('button', { name: '创建', exact: true }),
        ).toBeInViewport();
        await page.screenshot({
          path: `storage/ui-workflow/assignment/zh-${width}-${dark}.png`,
          animations: 'disabled',
        });
      }
    }
  } finally {
    expect(
      (
        await page.request.post(apiUrl(`users/${user.id}/disable`), { headers })
      ).status(),
    ).toBe(200);
  }
});
