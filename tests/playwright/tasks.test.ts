/// <reference lib="dom" />
import { test, expect, type Page, type BrowserContext } from '@playwright/test';
const entry = process.env.APP_URL;
if (!entry)
  throw new Error(
    'Set APP_URL to the application entry URL, including its base path.',
  );
const base = new URL(entry.endsWith('/') ? entry : `${entry}/`),
  tasks = new URL('tasks', base).href,
  api = new URL('api/tasks', base).href;
const headers = { origin: base.origin };
test.use({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 2,
  actionTimeout: 15000,
  launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        args: ['--no-sandbox'],
      }
    : {},
});
let authState: Awaited<ReturnType<BrowserContext['storageState']>> | undefined;
async function login(page: Page) {
  if (authState) {
    await page.context().addCookies(authState.cookies);
    await page.goto(tasks);
    await expect(
      page.getByRole('heading', { name: 'Tasks', exact: true }),
    ).toBeVisible();
    return;
  }
  await page.goto(base.href);
  await page
    .getByLabel('Username or email', { exact: true })
    .fill(process.env.TUTORIAL_USERNAME ?? 'nocobase');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.TUTORIAL_PASSWORD ?? 'admin123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('link', { name: 'Tasks', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Tasks', exact: true }),
  ).toBeVisible();
  authState = await page.context().storageState();
}
async function remove(page: Page, id: string) {
  const res = await page.request.get(`${api}/${id}`);
  if (!res.ok()) return;
  const { data } = await res.json();
  await page.request.delete(`${api}/${id}`, {
    headers,
    params: { expectedUpdatedAt: data.updatedAt },
  });
}

test('full task journey, URL continuity, validation and persistence', async ({
  page,
}) => {
  await login(page);
  const title = `Browser task ${Date.now()}`;
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByText('Enter a title.', { exact: true })).toBeVisible();
  await expect(page.locator('#task-title')).toBeFocused();
  await page.locator('#task-title').pressSequentially(title);
  await page
    .locator('#task-description')
    .fill('Prepare the launch checklist and review it with the team.');
  await page.locator('#task-assignee').click();
  await page.getByRole('button', { name: 'Super Admin', exact: true }).click();
  await page.locator('#task-due').click();
  await page
    .getByRole('gridcell')
    .filter({ hasText: /^28$/ })
    .getByRole('button')
    .last()
    .click();
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: title });
  await expect(row).toBeVisible();
  const { data } = await (
    await page.request.get(api, { params: { q: title } })
  ).json();
  const id = data[0].id as string;
  try {
    await page.reload();
    await expect(row).toBeVisible();
    await page.goto(`${tasks}?q=${encodeURIComponent(title)}&status=todo`);
    await row.getByRole('link', { name: title, exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: title, exact: true }),
    ).toContainText('Prepare the launch checklist');
    await page
      .getByRole('dialog', { name: title, exact: true })
      .getByRole('button', { name: `Actions for ${title}`, exact: true })
      .click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Edit task', exact: true }),
    ).toBeVisible();
    await page.locator('#task-title').fill(`${title} revised`);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Edit task', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('dialog', { name: `${title} revised`, exact: true }),
    ).toBeVisible();
    await page
      .getByRole('dialog', { name: `${title} revised`, exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp('status=todo'));
    await expect(page.locator('[data-slot=route-overlay-content]')).toHaveCount(
      0,
    );
    await row.getByRole('button', { name: /Actions for/ }).click();
    await page
      .getByRole('menuitem', { name: 'In progress', exact: true })
      .click();
    await expect(
      page.getByText('No matching tasks', { exact: true }),
    ).toBeVisible();
    await page.goto(`${tasks}?q=${encodeURIComponent(title)}`);
    await row.getByRole('button', { name: /Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText(
      `${title} revised`,
    );
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await row.getByRole('button', { name: /Actions for/ }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(
      page.getByRole('textbox', { name: 'Search by title…', exact: true }),
    ).toBeFocused();
  } finally {
    await remove(page, id);
  }
});

test('keeps a successful create visible when list refresh fails', async ({
  page,
}) => {
  await login(page);
  const title = `Refresh failure ${Date.now()}`;
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.locator('#task-title').fill(title);
  await page.route('**/api/tasks?**', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('link', { name: title, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText(
    'Your changes were saved',
  );
  await page.unroute('**/api/tasks?**');
  const { data } = await (
    await page.request.get(api, { params: { q: title } })
  ).json();
  expect(data).toHaveLength(1);
  await remove(page, data[0].id);
});

test('blocks duplicate saves and browser Back while a save is pending', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  const title = `Pending save ${Date.now()}`;
  await page.locator('#task-title').fill(title);
  let writes = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/tasks', async (route) => {
    if (route.request().method() === 'POST') {
      writes++;
      await gate;
    }
    await route.continue();
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('button', { name: /Create/ })).toBeDisabled();
  await page.goBack();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('dialog', { name: 'New task', exact: true }),
  ).toHaveCount(0);
  expect(writes).toBe(1);
  await page.unroute('**/api/tasks');
  const { data } = await (
    await page.request.get(api, { params: { q: title } })
  ).json();
  await remove(page, data[0].id);
});

test('retains drafts after a failed save and explains a missing task', async ({
  page,
}) => {
  await login(page);
  const title = `Recovery ${Date.now()}`;
  const created = await page.request.post(api, { headers, data: { title } });
  const { data: task } = await created.json();
  try {
    await page.goto(`${tasks}/edit/${task.id}`);
    await page.locator('#task-title').fill(`${title} revised`);
    await page.route(`${api}/${task.id}`, async (route) => {
      if (route.request().method() === 'PATCH') await route.abort('failed');
      else await route.continue();
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('#task-title')).toHaveValue(`${title} revised`);
    await page.unroute(`${api}/${task.id}`);
    await remove(page, task.id);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText(title);
    await expect(
      page.getByRole('button', { name: 'Save', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('button', { name: 'Close', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(tasks);
  } finally {
    await remove(page, task.id);
  }
});
