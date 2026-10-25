# Activity log tutorial plugin

A reusable NocoBase 3 plugin demonstrated by the task application in this repository. The plugin supplies activity storage, a read API, a client page and a CLI count command. The host explicitly records `task.created` after its own authorization check, in the same database transaction as the task. It does not automatically capture other operations or promise a tamper-proof audit trail.

## Run the example

Use Node 24 and pnpm 11.7 from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm dev
```

Open the `Local:` application URL printed by the server, including its base path. Sign in with the initial administrator configured for this local application, create a task, and open Activity log. A fresh database starts without activity records. Task updates and deletions do not create records in this version.

## Integrate into another application

This tutorial package is available as source, not published to npm. Build and pack it, install the tarball in the consuming application, and register it there:

```bash
pnpm --filter @nocobase/app-plugin-tutorial-activity-log pack --pack-destination /tmp
# In the consuming application:
pnpm add /tmp/nocobase-app-plugin-tutorial-activity-log-0.1.0.tgz
pnpm nocobase plugin register @nocobase/app-plugin-tutorial-activity-log --no-install --dry-run --json
pnpm nocobase plugin register @nocobase/app-plugin-tutorial-activity-log --no-install
```

The registration command composes the public Client, Server and CLI exports and synchronizes the published Skill. Also register `defineActivityLogConfig()` from the public `./config` export under `activityLog` in the application's configuration factories. `ACTIVITY_LOG_PAGE_SIZE` controls the server default, from 1 to 100; the client plugin option `pageSize` controls the page's explicit request size and defaults to 20. These settings are independent; public configuration projection does not automatically configure React.

Import `activityLogToken` from `@nocobase/app-plugin-tutorial-activity-log/server`, resolve it from the application's container and call `record({ actorId, action, subject, summary }, connection)` inside the authorized business transaction. `actorId` comes from the verified server session. The optional connection must belong to the database containing the activity table. Without a connection, recording is a separate write on the default connection.

## Permissions and API

The page's stable route ID is `@nocobase/app-plugin-tutorial-activity-log:activity-log`. Page access and API access are separate: the plugin declares page `activity-log` / action `access` and business resource `activityLog:all` / action `read`. The application assigns both grants to explicitly chosen readers. Installation grants no reader access. The read permission permits reading all activity records in this application; it is not a per-user or tenant filter.

`GET <app-base-path>/api/activityLog/records?page=1&pageSize=20` returns `{ data, meta: { total, page, pageSize } }`. Anonymous access is rejected with 401, ungranted access with 403, and invalid authorized queries with 400. The endpoint is included in the application API document. There is no browser-accessible record creation endpoint.

```bash
pnpm nocobase tutorial-activity-log count --json
```

The CLI is an operator command using local application configuration. It is not an end-user session and does not inherit browser permissions.

## Verification

```bash
pnpm --filter @nocobase/app-plugin-tutorial-activity-log lint
pnpm --filter @nocobase/app-plugin-tutorial-activity-log typecheck
pnpm --filter @nocobase/app-plugin-tutorial-activity-log test
pnpm --filter @nocobase/app-plugin-tutorial-activity-log build
pnpm exec vitest run --config vitest.plugin.config.ts
node scripts/verify-activity-log-package.mjs
```

The last script packs the plugin, creates an independent temporary consumer with the host application's source and a tarball dependency, installs dependencies, asserts compiled exports and migration manifests, runs the host integration test, typechecks and builds the client. It leaves the directory for inspection and prints its path. It does not copy local configuration or storage. A source install passing tests does not replace this packaged-consumer check.

The pinned application CLI converts a tarball dependency into an npm version when assembling production dependencies. Because this example is not published to npm, run the full application deployment build from this workspace (`pnpm build`), where `workspace:*` packages are vendored. A tarball consumer verifies runtime integration and frontend compilation, not a complete production deployment.

Persistent settings, background jobs and Registry recipes are optional extension topics in the documentation and are not implemented by this package.
