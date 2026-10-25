import { describe, expect, it } from 'vitest';
import { resolveAppRuntime } from '@nocobase/app-client/runtime';
import appRuntime from '../../client/runtime.js';
import cliPlugins from '../../cli/plugins.js';
import serverPlugins from '../../server/plugins.js';
import { buildRouteNavigation } from '../../client/routing/route-navigation.js';

describe('task application Foundation integration', () => {
  it('registers the Foundation deployment evidence build hook', () => {
    expect(
      cliPlugins.plugins.filter(
        (plugin) => plugin.packageName === '@nocobase/app-plugin-foundation',
      ),
    ).toHaveLength(1);
  });
  it('protects Foundation while retaining registered business settings when Foundation is denied', async () => {
    const runtime = await resolveAppRuntime(appRuntime);
    const menu = buildRouteNavigation(runtime.routes, new Set());
    const group = menu.find(({ route }) => route.name === 'settings');
    const page = group?.children.find(
      ({ route }) => route.name === 'foundation',
    )?.route;
    expect(page).toMatchObject({
      path: '/foundation',
      auth: 'required',
      authz: 'unrestricted',
    });
    if (!page) throw new Error('Foundation route missing');
    const deniedMenu = buildRouteNavigation(
      runtime.routes,
      new Set([`${page.packageName}:${page.path}:${page.id}`]),
    );
    const deniedSettings = deniedMenu.find(
      ({ route }) => route.name === 'settings',
    );
    expect(deniedSettings).toBeDefined();
    expect(
      deniedSettings?.children.some(({ route }) => route.name === 'foundation'),
    ).toBe(false);
    expect(deniedSettings?.children.length).toBeGreaterThan(0);
    expect(
      serverPlugins.plugins.filter(
        (plugin) => plugin.packageName === '@nocobase/app-plugin-foundation',
      ),
    ).toHaveLength(1);
  });

  it('merges Foundation into business settings without changing its protected URL', async () => {
    const runtime = await resolveAppRuntime(appRuntime);
    const menu = buildRouteNavigation(runtime.routes, new Set());
    expect(menu.some(({ route }) => route.name === 'foundationSettings')).toBe(
      false,
    );
    expect(menu.filter(({ route }) => route.name === 'settings')).toHaveLength(
      1,
    );
    const settings = menu.find(({ route }) => route.name === 'settings');
    expect(
      settings?.children.filter(({ route }) => route.name === 'foundation'),
    ).toHaveLength(1);
    expect(settings?.children.at(-1)?.route).toMatchObject({
      name: 'foundation',
      path: '/foundation',
      authz: 'unrestricted',
    });
  });
});
