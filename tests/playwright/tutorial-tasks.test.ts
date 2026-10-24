/// <reference lib="dom" />
import { test, expect } from '@playwright/test';

const entry = process.env.APP_URL;
if (!entry)
  throw new Error(
    'Set APP_URL to the application entry URL printed by pnpm dev, including its base path.',
  );
const appUrl = new URL(entry.endsWith('/') ? entry : `${entry}/`);
const taskUrl = new URL('tasks', appUrl).href;
const taskApi = new URL('api/tutorialTasks', appUrl).href;

test.use({
  actionTimeout: 15000,
  viewport: { width: 1440, height: 960 },
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        args: ['--no-sandbox'],
      }
    : {},
});

test('creates, completes, reopens and preserves a task after reload', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
    console.error(error.message);
  });
  await page.goto(appUrl.href);
  await page
    .getByLabel('Username or email', { exact: true })
    .fill(process.env.TUTORIAL_USERNAME ?? 'nocobase');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.TUTORIAL_PASSWORD ?? 'admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole('button', { name: 'New task', exact: true }),
  ).toHaveCount(1);
  await page.screenshot({
    path: 'storage/ui-workflow/tasks/screenshots/initial.png',
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await expect(page).toHaveURL(`${taskUrl}/create`);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByText('Enter a task title.', { exact: true }),
  ).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Title', exact: false });
  await expect(input).toBeFocused();
  await input.fill('x'.repeat(121));
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByText('Use no more than 120 characters.'),
  ).toBeVisible();
  const title = `Write the first feature tutorial ${Date.now()}`;
  await input.fill('');
  await input.pressSequentially(title);
  await input.press('Home');
  await input.pressSequentially('Review: ');
  const finalTitle = `Review: ${title}`;

  // Abort one request to exercise the network-failure boundary.
  await page.route(taskApi, async (route) => {
    if (route.request().method() === 'POST') await route.abort('failed');
    else await route.continue();
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('The request failed. Please try again.', { exact: true }),
  ).toBeVisible();
  await expect(input).toHaveValue(finalTitle);
  await page.unroute(taskApi);

  // Send invalid data to the real server to exercise its field-error response.
  // Client validation otherwise prevents this request; no response is fabricated.
  await page.route(taskApi, async (route) => {
    if (route.request().method() === 'POST') {
      await route.continue({ postData: JSON.stringify({ title: '' }) });
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#tutorial-task-title-error')).toHaveText(
    'Enter a task title.',
  );
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await expect(input).toHaveAttribute(
    'aria-describedby',
    'tutorial-task-title-error',
  );
  await expect(input).toBeFocused();
  await expect(input).toHaveValue(finalTitle);
  await page.unroute(taskApi);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: finalTitle });
  await expect(row).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'New task', exact: true }),
  ).toHaveCount(1);
  await row.getByRole('button', { name: 'Complete', exact: true }).click();
  await expect(row.getByText('Completed', { exact: true })).toBeVisible();
  await page.reload();
  await expect(row.getByText('Completed', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: 'Reopen', exact: true }).click();
  await expect(row.getByText('Pending', { exact: true })).toBeVisible();
  await page.reload();
  await expect(row.getByText('Pending', { exact: true })).toBeVisible();

  // A direct URL and browser history preserve the route-backed creation dialog.
  await page.goto(`${taskUrl}/create`);
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toHaveCount(0);
  await page.goForward();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Title', exact: false })
    .press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }).locator('span'),
  ).toBeFocused();

  // Inspect the actual API document using the signed-in session.
  const schema = await page.request.get(new URL('api/swagger', appUrl).href);
  expect(schema.status()).toBe(200);
  expect(JSON.stringify(await schema.json())).toContain('createTutorialTask');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 960 });
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await page.screenshot({
      path: `storage/ui-workflow/tasks/screenshots/tasks-dark-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.evaluate(() =>
      document.documentElement.classList.remove('dark'),
    );
    await page.screenshot({
      path: `storage/ui-workflow/tasks/screenshots/tasks-light-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: /Language/ }).click();
  await page.getByRole('menuitemradio', { name: /中文/ }).click();
  await expect(
    page.getByRole('heading', { name: '任务', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '新建任务', exact: true }).click();
  const chineseInput = page
    .getByRole('dialog', { name: '新建任务', exact: true })
    .getByRole('textbox', { name: '标题', exact: false });
  await chineseInput.click();
  await expect(chineseInput).toBeFocused();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text: 'ce shi',
    selectionStart: 0,
    selectionEnd: 5,
  });
  await chineseInput.dispatchEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    isComposing: true,
  });
  await expect(
    page.getByRole('dialog', { name: '新建任务', exact: true }),
  ).toBeVisible();
  await expect(chineseInput).toBeFocused();
  await cdp.send('Input.insertText', { text: '测试任务' });
  await expect(chineseInput).toHaveValue('测试任务');
  await page.screenshot({
    path: 'storage/ui-workflow/tasks/screenshots/create-zh.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.getByRole('button', { name: '取消', exact: true }).click();
  for (const preset of ['compact', 'default']) {
    for (const width of [1440, 375]) {
      await page.setViewportSize({ width, height: 960 });
      for (const dark of [false, true]) {
        await page.evaluate(
          ({ preset, dark }) => {
            document.documentElement.dataset.theme = preset;
            document.documentElement.classList.toggle('dark', dark);
          },
          { preset, dark },
        );
        await page.screenshot({
          path: `storage/ui-workflow/tasks/screenshots/tasks-zh-${preset}-${dark ? 'dark' : 'light'}-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('ordinary users need explicit grants and read-only users cannot write', async ({
  page,
  browser,
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
  const headers = { origin: appUrl.origin };
  const apiUrl = (path: string) => new URL(`api/${path}`, appUrl).href;
  const key = `tutorial-reader-${Date.now()}`;
  const email = `${key}@example.test`;
  const password = 'tutorial-browser-test-password';
  const created = await page.request.post(apiUrl('users'), {
    headers,
    data: { name: 'Tutorial reader', email, password },
  });
  expect(created.status()).toBe(201);
  const userId = (await created.json()).data.id;
  const context = await browser.newContext();
  let roleCreated = false;
  try {
    const reader = await context.newPage();
    await reader.goto(appUrl.href);
    await reader.getByLabel('Username or email', { exact: true }).fill(email);
    await reader.getByLabel('Password', { exact: true }).fill(password);
    await reader.getByRole('button', { name: 'Sign in', exact: true }).click();
    await reader.getByRole('button', { name: 'Open account menu' }).waitFor();
    await expect(
      reader.getByRole('link', { name: 'Tasks', exact: true }),
    ).toHaveCount(0);
    expect((await reader.request.get(taskApi)).status()).toBe(403);
    const { taskPermissions } =
      await import('../../server/providers/tutorial-tasks.js');
    const role = await page.request.post(
      apiUrl('authorization/permissionSets'),
      {
        headers,
        data: {
          key,
          title: 'Tutorial reader',
          grants: [
            {
              resource: { type: 'page', id: 'tasks' },
              actions: [{ action: 'access' }],
            },
            taskPermissions
              .reference()
              .grant({ read: { tasks: 'allRecords' } }),
          ],
        },
      },
    );
    expect(role.status()).toBe(201);
    roleCreated = true;
    // Registered business permissions must also be selectable in the application's role editor.
    await page.goto(new URL(`settings/roles/${key}/edit`, appUrl).href);
    await page
      .getByRole('button', { name: 'Business operations', exact: true })
      .click();
    await expect(
      page.getByRole('checkbox', { name: 'View tasks', exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'New task', exact: true }),
    ).not.toBeChecked();
    await expect(
      page.getByRole('checkbox', {
        name: 'Complete or reopen tasks',
        exact: true,
      }),
    ).not.toBeChecked();
    expect(
      (
        await page.request.post(
          apiUrl(`authorization/permissionSets/${key}/assignments`),
          { headers, data: { subject: { type: 'user', id: userId } } },
        )
      ).status(),
    ).toBe(201);
    await reader.goto(taskUrl);
    await expect(
      reader.getByRole('heading', { name: 'Tasks', exact: true }),
    ).toBeVisible({ timeout: 20000 });
    await expect(reader.getByRole('table')).toBeVisible();
    await expect(
      reader.getByRole('button', { name: 'New task', exact: true }),
    ).toHaveCount(0);
    await expect(
      reader.getByRole('button', { name: /^(Complete|Reopen)$/ }),
    ).toHaveCount(0);
    expect(
      (
        await reader.request.post(taskApi, {
          headers,
          data: { title: 'Not allowed' },
        })
      ).status(),
    ).toBe(403);
    const tasks = (await (await reader.request.get(taskApi)).json()).data;
    expect(
      (
        await reader.request.patch(`${taskApi}/${tasks[0].id}`, {
          headers,
          data: { completed: true },
        })
      ).status(),
    ).toBe(403);
    await reader.screenshot({
      path: 'storage/ui-workflow/tasks/screenshots/read-only.png',
      fullPage: true,
      animations: 'disabled',
    });
  } finally {
    await context.close();
    expect(
      (
        await page.request.post(apiUrl(`users/${userId}/disable`), { headers })
      ).ok(),
    ).toBe(true);
    if (roleCreated)
      expect(
        (
          await page.request.delete(
            apiUrl(`authorization/permissionSets/${key}`),
            { headers },
          )
        ).ok(),
      ).toBe(true);
  }
});
