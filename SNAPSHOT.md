# Team task application snapshot

This example was freshly generated from the NocoBase `v3-develop` source commit `53a2c63094231a7450215748c00d1ca5367d9091` with the default template version `1.0.0-beta.80`. Its business feature includes task CRUD, assignees, due dates, progress, search, filters, sorting, pagination and explicit role assignments.

## Prepare matching dependencies

The dependency versions were published to an isolated local `unreleased` registry. They can have the same version strings as different public npm artifacts. Installing the public packages with matching version numbers does not reproduce this example.

Use Node.js 24, pnpm 11.7 and Docker. In a separate source checkout alongside this application:

```bash
git clone --branch v3-develop https://github.com/nocobase/nocobase.git nocobase-source
cd nocobase-source
git checkout 53a2c63094231a7450215748c00d1ca5367d9091
pnpm install --frozen-lockfile
pnpm unreleased:prepare

# Keep the complete isolated registry and cache environment in this shell.
eval "$(pnpm -s unreleased:env)"
cd ../team-tasks
pnpm install --frozen-lockfile
```

Use the application directory name you chose in place of `team-tasks`. Do not keep only the registry URL from `unreleased:env`: its isolated configuration and cache prevent public packages with identical versions from being reused. The local registry must remain available for installation and for builds that resolve deployment dependencies.

If the local proxy cannot fetch third-party packages because of a TLS problem, the following process-local environment routes ordinary dependencies to npm while keeping the `@nocobase` scope on the snapshot registry:

```bash
export PNPM_CONFIG_REGISTRY=https://registry.npmjs.org
export npm_config_registry=https://registry.npmjs.org
export NPM_CONFIG_REGISTRY=https://registry.npmjs.org
pnpm install --frozen-lockfile
```

This fallback was used for the documented verification. It does not disable TLS verification or change global configuration.

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
