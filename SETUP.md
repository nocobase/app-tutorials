# Team task application

This example uses packages published on npmjs.org and the NocoBase default template `1.0.0-beta.81`. It includes task CRUD, assignees, due dates, progress, search, filtering, sorting, pagination and explicitly assigned roles.

## Install

Use Node.js 24 and pnpm 11.7. The repository’s `.npmrc` selects `https://registry.npmjs.org/` for both ordinary and `@nocobase` packages. The committed lockfile fixes the verified dependency versions. No local registry, NocoBase source checkout or Docker is required to run this SQLite example.

```bash
pnpm install --frozen-lockfile
```

## Configure and run

```bash
pnpm nocobase config init
pnpm nocobase config check
pnpm dev
```

Open the application `Local:` URL printed by `pnpm dev`. Use the initial administrator in your generated configuration. Configuration, secrets, databases, sign-in sessions and screenshot sample data are not included in this repository.

The migration creates the task table. The required seed registers Task manager, Task member and Task reader roles without assigning them to everyone. Create your own people in Users and explicitly assign their roles. Task members can read and update progress only on their own assigned tasks; readers cannot write, including through direct requests.

## Verification

The feature tests use the current template's `tests/client`, `tests/server`, `tests/database` and `tests/playwright` structure. Server and client tests boot real applications with isolated SQLite databases. Failure tests inject only the exceptional transport behavior being verified.

```bash
pnpm exec vitest run tests/server/tasks.test.ts tests/server/authorization-assignment-safety.test.ts tests/database/tasks-migration.test.ts tests/client/tasks.test.tsx tests/client/client-routes.test.ts tests/client/page-permission-titles.test.ts
pnpm exec playwright install chromium
TUTORIAL_ORIGIN=http://127.0.0.1:13000 \
TUTORIAL_USERNAME=<test-admin> TUTORIAL_PASSWORD=<test-password> \
pnpm exec playwright test tests/playwright/tasks.test.ts
```

Point browser tests only at a disposable local test application. They prepare explicitly named demo accounts with documented test-only credentials and task fixtures. Task fixtures are removed after the run; demo accounts remain. They are not production provisioning scripts.

Validated with SQLite and Chromium. PostgreSQL/MySQL, production deployment, load, high availability and simultaneous multi-browser writes have not been verified for this example.
