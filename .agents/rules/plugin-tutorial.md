# Plugin tutorial workspace

The root remains the tutorial application. `packages/app-plugin-activity-log` is an explicitly requested reusable plugin, owned separately from the task application. Follow its own `AGENTS.md` for package changes. `pnpm-workspace.yaml` selects `packages/*`; the root depends on the plugin with `workspace:*`, while Core packages come from npm at the lockfile versions.

The application registers the plugin through the CLI and owns the `activityLog` configuration section. Task creation calls the public service in the same transaction as its authorized task write. Do not import plugin internals, add implicit grants, edit historical task migrations, or move the existing application merely to add a package.

Run plugin checks through its package filter and host integration with `pnpm exec vitest run --config vitest.plugin.config.ts`. Before documenting release behavior, pack the plugin and test the compiled exports and migrations from a separate consumer. Local configuration, storage and generated tarballs stay ignored.
