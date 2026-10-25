import { test, expect, type Page } from '@playwright/test';
const origin = process.env.TUTORIAL_ORIGIN ?? 'http://127.0.0.1:13000';
const base = `${origin}/main`;
test.setTimeout(45_000);
test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
async function login(
  page: Page,
  username = process.env.TUTORIAL_USERNAME ?? 'nocobase',
  password = process.env.TUTORIAL_PASSWORD ?? 'admin123',
) {
  if (
    adminState &&
    username === (process.env.TUTORIAL_USERNAME ?? 'nocobase')
  ) {
    await page.context().addCookies(adminState.cookies);
    await page.goto(`${base}/`);
    return;
  }
  await page.goto(`${base}/login`);
  await page.getByRole('textbox', { name: 'Username or email' }).fill(username);
  await page
    .getByRole('textbox', { name: 'Password', exact: true })
    .fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/main\/?$/u);
}
const fixtureTaskIds: string[] = [];
let adminState:
  | Awaited<
      ReturnType<import('@playwright/test').BrowserContext['storageState']>
    >
  | undefined;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  adminState = await context.storageState();
  const people: Record<string, string> = {};
  for (const [name, username, role] of [
    ['Alice Morgan', 'alice', 'task-manager'],
    ['Bob Chen', 'bob', 'task-member'],
    ['Casey Rivera', 'casey', 'task-reader'],
    ['Dana Park', 'dana', null],
  ] as const) {
    const found = await (
      await context.request.get(
        `${base}/api/users?q=${username}%40example.test`,
      )
    ).json();
    if (found.data.length) people[username] = found.data[0].id;
    else {
      const response = await context.request.post(`${base}/api/users`, {
        headers: { origin },
        data: {
          name,
          username,
          email: `${username}@example.test`,
          password: 'Tutorial123!',
          roleScopes: { app: role ? [role] : [] },
        },
      });
      expect(response.status()).toBe(201);
      people[username] = (await response.json()).data.id;
    }
  }
  for (let index = 0; index < 12; index++) {
    const response = await context.request.post(`${base}/api/tasks`, {
      headers: { origin },
      data: {
        title: `Fixture task ${index + 1}`,
        assigneeId: people.bob,
        dueDate: '2026-11-01',
      },
    });
    expect(response.status()).toBe(201);
    fixtureTaskIds.push((await response.json()).data.id);
  }
  await context.close();
});
test.afterAll(async ({ browser }) => {
  if (!adminState) return;
  const context = await browser.newContext({ storageState: adminState });
  for (const id of fixtureTaskIds) {
    const response = await context.request.get(`${base}/api/tasks/${id}`);
    if (!response.ok()) continue;
    const { data } = await response.json();
    await context.request.delete(
      `${base}/api/tasks/${id}?${new URLSearchParams({ expectedUpdatedAt: data.updatedAt })}`,
      { headers: { origin } },
    );
  }
  await context.close();
});
async function tasks(page: Page) {
  await page.goto(`${base}/tasks`);
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Refresh', exact: true }),
  ).toBeEnabled();
}
async function shot(page: Page, name: string) {
  await page.screenshot({
    path: `storage/ui-workflow/tasks/screenshots/${name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

test('complete CRUD, query state, assignee picker, dates, and genuine persistence', async ({
  page,
}) => {
  await login(page);
  await tasks(page);
  await shot(page, 'task-list');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Enter a task title.')).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Title', exact: false }),
  ).toBeFocused();
  const title = `Browser verification ${Date.now()}`;
  await page
    .getByRole('textbox', { name: 'Title', exact: false })
    .pressSequentially(title);
  await page
    .getByRole('textbox', { name: 'Description', exact: true })
    .pressSequentially('Check the full team task workflow.');
  await page
    .getByRole('combobox', { name: 'Assignee', exact: true })
    .fill('Bob');
  await page.getByRole('option', { name: 'Bob Chen', exact: true }).click();
  await page.getByRole('button', { name: 'Due date', exact: true }).click();
  await page
    .locator('button[data-day]')
    .filter({ hasText: /^15$/u })
    .first()
    .click();
  await page.keyboard.press('Escape');
  await shot(page, 'task-create');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('link', { name: title, exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${base}/tasks`);
  await page.reload();
  await expect(
    page.getByRole('link', { name: title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Search by title…' })
    .pressSequentially(title);
  await expect(page).toHaveURL(/q=Browser/u);
  await page.getByRole('link', { name: title, exact: true }).click();
  await expect(page.locator('[data-slot=route-overlay-content]')).toBeVisible();
  await shot(page, 'task-detail');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
    2,
  );
  await page
    .getByRole('textbox', { name: 'Title', exact: false })
    .fill(`${title} revised`);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
    1,
  );
  await expect(
    page.getByRole('heading', { name: `${title} revised`, exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Back to tasks', exact: true })
    .click();
  await expect(page).toHaveURL(/q=Browser/u);
  await page
    .getByRole('button', { name: `Actions for ${title} revised`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Start', exact: true }).click();
  await expect(
    page.getByRole('row').filter({ hasText: `${title} revised` }),
  ).toContainText('In progress');
  await page
    .getByRole('button', { name: `Actions for ${title} revised`, exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toContainText(`${title} revised`);
  await expect(page.getByRole('alertdialog')).toContainText(
    'This cannot be undone.',
  );
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(
    page.getByText('No matching tasks', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('textbox', { name: 'Search by title…' }),
  ).toBeFocused();
  await shot(page, 'no-results');
});

test('failed writes retain drafts; pending save blocks Back and only submits once; failed reload keeps confirmed data', async ({
  page,
}) => {
  await login(page);
  await tasks(page);
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const title = `Reliability verification ${Date.now()}`;
  await page.getByRole('textbox', { name: /Title/u }).fill(title);
  let hold: (() => void) | undefined;
  let mode = 'fail';
  let posts = 0;
  let saved = false;
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts++;
    if (mode === 'fail')
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 500,
            status: 'INTERNAL',
            message: 'Deliberate test failure',
          },
        }),
      });
    await new Promise<void>((resolve) => {
      hold = resolve;
    });
    const response = await route.fetch();
    saved = true;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Your changes have been kept',
  );
  await expect(page.getByRole('textbox', { name: /Title/u })).toHaveValue(
    title,
  );
  await shot(page, 'save-failure');
  mode = 'hold';
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  await page.goBack();
  await expect(page.locator('[data-slot=route-overlay-content]')).toBeVisible();
  await expect(page.getByRole('textbox', { name: /Title/u })).toHaveValue(
    title,
  );
  expect(posts).toBe(2);
  await page.route('**/api/tasks?*', (route) =>
    saved ? route.abort() : route.continue(),
  );
  hold?.();
  await expect(
    page.getByRole('link', { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Your changes were saved/u)).toBeVisible();
  await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
    0,
  );
  await shot(page, 'saved-reload-failure');
  await page.unroute('**/api/tasks?*');
  await page.unroute('**/api/tasks');
  const data = await (
    await page.request.get(`${base}/api/tasks?q=${encodeURIComponent(title)}`)
  ).json();
  expect(data.meta.total).toBe(1);
  const response = await page.request.delete(
    `${base}/api/tasks/${data.data[0].id}?${new URLSearchParams({ expectedUpdatedAt: data.data[0].updatedAt })}`,
    { headers: { origin } },
  );
  expect(response.ok()).toBeTruthy();
});

test('real member, reader and unassigned accounts have distinct access', async ({
  browser,
}) => {
  for (const [user, allowed] of [
    ['bob', true],
    ['casey', true],
    ['dana', false],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await login(page, user, 'Tutorial123!');
    if (!allowed) {
      await expect(
        page.getByRole('link', { name: 'Tasks', exact: true }),
      ).toHaveCount(0);
      const denied = await page.request.get(`${base}/api/tasks`);
      expect(denied.status()).toBe(403);
    } else {
      await tasks(page);
      await expect(
        page.getByRole('button', { name: 'New task', exact: true }),
      ).toHaveCount(0);
      const response = await page.request.get(`${base}/api/tasks`);
      const data = await response.json();
      expect(data.data.length).toBeGreaterThan(0);
      if (user === 'bob') {
        expect(
          data.data.every(
            (row: { assigneeName: string }) => row.assigneeName === 'Bob Chen',
          ),
        ).toBeTruthy();
        await page
          .getByRole('button', { name: /^Actions for/u })
          .first()
          .click();
        await expect(
          page.getByRole('menuitem', { name: 'Edit', exact: true }),
        ).toHaveCount(0);
        await expect(
          page.getByRole('menuitem', { name: 'Delete', exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(
          page.getByRole('button', { name: /^Actions for/u }),
        ).toHaveCount(0);
        await shot(page, 'read-only-tasks');
        const denied = await page.request.post(`${base}/api/tasks`, {
          headers: { origin },
          data: { title: 'Forbidden' },
        });
        expect(denied.status()).toBe(403);
      }
    }
    await context.close();
  }
});

test('pagination, sorting, IME, narrow layout and both theme presets', async ({
  page,
  context,
}) => {
  await login(page);
  await tasks(page);
  await page
    .getByRole('button', { name: 'Go to next page', exact: true })
    .click();
  await expect(page).toHaveURL(/page=2/u);
  await page.reload();
  await expect(page.getByText(/^Page 2 of \d+$/u)).toBeVisible();
  await page.getByRole('button', { name: 'Due date', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Asc', exact: true }).click();
  await expect(page).toHaveURL(/orderBy=dueDate%3Aasc/u);
  const input = page.getByRole('textbox', { name: 'Search by title…' });
  await input.click();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.imeSetComposition', {
    text: 'ren',
    selectionStart: 3,
    selectionEnd: 3,
  });
  await cdp.send('Input.insertText', { text: '任务' });
  await expect(input).toHaveValue('任务');
  await expect(page).toHaveURL(/q=%E4%BB%BB%E5%8A%A1/u);
  await input.fill('');
  await expect(page).not.toHaveURL(/q=/u);
  for (const preset of ['compact', 'default'])
    for (const scheme of ['light', 'dark']) {
      await page.evaluate(
        ({ preset, scheme }) => {
          localStorage.setItem('nocobase:main:theme:preset', preset);
          localStorage.setItem('nocobase:main:theme:color-scheme', scheme);
        },
        { preset, scheme },
      );
      await page.reload();
      await expect(
        page.getByRole('button', { name: 'Refresh', exact: true }),
      ).toBeEnabled();
      await shot(page, `${preset}-${scheme}`);
    }
  await page.setViewportSize({ width: 375, height: 812 });
  await shot(page, 'mobile');
  expect(
    await page.evaluate(
      'document.documentElement.scrollWidth <= window.innerWidth',
    ),
  ).toBeTruthy();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Create', exact: true }),
  ).toBeVisible();
  await shot(page, 'mobile-form');
});

test('delete preflight failure, invalid query recovery and overlay focus', async ({
  page,
}) => {
  await login(page);
  await tasks(page);
  const item = page.getByRole('link', { name: 'Fixture task 12', exact: true });
  await item.click();
  await expect(page.locator('[data-slot=route-overlay-content]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
    0,
  );
  await expect
    .poll(() => page.evaluate('document.activeElement.tagName'))
    .not.toBe('BODY');
  await page.route('**/api/tasks/*/delete', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: {
          code: 503,
          status: 'UNAVAILABLE',
          message: 'Deliberate preflight failure',
        },
      }),
    }),
  );
  await page
    .getByRole('button', { name: 'Actions for Fixture task 12', exact: true })
    .click();
  await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  await expect(confirmation.getByRole('alert')).toBeVisible();
  await expect(
    confirmation.getByRole('button', { name: 'Delete', exact: true }),
  ).toBeDisabled();
  await page.unroute('**/api/tasks/*/delete');
  await confirmation
    .getByRole('button', { name: 'Try again', exact: true })
    .click();
  await expect(
    confirmation.getByRole('button', { name: 'Delete', exact: true }),
  ).toBeEnabled();
  await confirmation
    .getByRole('button', { name: 'Cancel', exact: true })
    .click();
  await page.goto(`${base}/tasks?page=1.5`);
  await expect(page.getByRole('alert')).toContainText(
    'list conditions are invalid',
  );
  await page
    .getByRole('alert')
    .getByRole('button', { name: 'Clear filters' })
    .click();
  await expect(page).toHaveURL(`${base}/tasks`);
  await expect(item).toBeVisible();
});

test('conflict reload confirms draft replacement; later disappearance returns to a fresh list', async ({
  page,
}) => {
  await login(page);
  const created = await page.request.post(`${base}/api/tasks`, {
    headers: { origin },
    data: { title: 'Fixture conflict task' },
  });
  let task = (await created.json()).data;
  fixtureTaskIds.push(task.id);
  await page.goto(`${base}/tasks/${task.id}`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  const title = page.getByRole('textbox', { name: /Title/u });
  await title.fill('My unsaved draft');
  const external = await page.request.patch(`${base}/api/tasks/${task.id}`, {
    headers: { origin },
    data: { title: 'Latest server title', expectedUpdatedAt: task.updatedAt },
  });
  task = (await external.json()).data;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page
    .getByRole('button', { name: 'Reload latest task', exact: true })
    .click();
  await expect(page.getByRole('alertdialog')).toContainText(
    'Fixture conflict task',
  );
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Cancel' })
    .click();
  await expect(title).toHaveValue('My unsaved draft');
  await page
    .getByRole('button', { name: 'Reload latest task', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(title).toHaveValue('Latest server title');
  await title.fill('Saved local title');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Saved local title', exact: true }),
  ).toBeVisible();
  task = (await (await page.request.get(`${base}/api/tasks/${task.id}`)).json())
    .data;
  const newer = await page.request.patch(`${base}/api/tasks/${task.id}`, {
    headers: { origin },
    data: { title: 'Newer remote title', expectedUpdatedAt: task.updatedAt },
  });
  task = (await newer.json()).data;
  await page.route(`**/api/tasks/${task.id}/status`, (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({
        error: { code: 409, status: 'ABORTED', message: 'Deliberate conflict' },
      }),
    }),
  );
  await page
    .locator('[data-slot=route-overlay-content]')
    .getByRole('button', { name: /^Actions for/u })
    .click();
  await page.getByRole('menuitem', { name: 'Start', exact: true }).click();
  await page
    .getByRole('button', { name: 'Reload latest task', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Newer remote title', exact: true }),
  ).toBeVisible();
  await page.unroute(`**/api/tasks/${task.id}/status`);
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await title.fill('Draft after external deletion');
  const deleted = await page.request.delete(
    `${base}/api/tasks/${task.id}?${new URLSearchParams({ expectedUpdatedAt: task.updatedAt })}`,
    { headers: { origin } },
  );
  expect(deleted.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(
    page.locator('[data-slot=route-overlay-content]').last().getByRole('alert'),
  ).toContainText('no longer exists');
  await page
    .locator('[data-slot=route-overlay-content]')
    .last()
    .getByRole('button', { name: 'Back to tasks', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await expect(page).toHaveURL(`${base}/tasks`);
  await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('link', { name: 'Newer remote title', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Search by title…' }),
  ).toBeFocused();
});

test('field-level date errors and expired-session guidance after a confirmed create', async ({
  page,
}) => {
  await login(page);
  await tasks(page);
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page
    .getByRole('textbox', { name: /Title/u })
    .fill('Fixture error classification');
  let rejectDate = true;
  let saved = false;
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    if (rejectDate)
      return route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 400,
            status: 'INVALID_ARGUMENT',
            message: 'Invalid date',
            fieldViolations: [
              { field: 'dueDate', description: 'Invalid date' },
            ],
          },
        }),
      });
    const response = await route.fetch();
    const body = await response.json();
    fixtureTaskIds.push(body.data.id);
    saved = true;
    return route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Due date', exact: true }),
  ).toHaveAttribute('aria-invalid', 'true');
  await expect(
    page.getByText('Choose a valid calendar date or clear the date.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Due date', exact: true }),
  ).toBeFocused();
  rejectDate = false;
  await page.route('**/api/tasks?*', (route) =>
    saved
      ? route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 401,
              status: 'UNAUTHENTICATED',
              message: 'Deliberate expired session',
            },
          }),
        })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText(/Your changes were saved/u)).toBeVisible();
  await expect(
    page.getByText('Your session has ended. Sign in again.'),
  ).toBeVisible();
  await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
    0,
  );
});
