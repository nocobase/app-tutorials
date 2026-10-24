# NocoBase application tutorials

A runnable task application for the [NocoBase application documentation](https://github.com/nocobase/app-docs). The documentation is Chinese-first and bilingual. This repository uses English UI, example data, comments and screenshots; the application's existing Chinese translations remain available.

## Start locally

Use Node.js 24 and pnpm 11. The project was generated with `pnpm create @nocobase/app@beta app-tutorials --template-tag=beta` from `@nocobase/app-template-default@1.0.0-beta.78`.

```bash
git clone https://github.com/nocobase/app-tutorials.git
cd app-tutorials
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm dev
```

Open the complete `Local:` address printed by the server, including its base path. Keep the terminal running. The default local administrator is `nocobase` with password `admin123`, unless you change `users.initialAdmin` in your ignored `config.yml`. Change that default password after signing in. Application configuration, credentials, databases, uploaded files and build output are not committed.

The repositories are private. You need access to the NocoBase organization to clone them or open the chapter links.

## Follow a chapter

| Tag | Application stage |
| --- | --- |
| `00-create-app` | Fresh default application, before adding business features |
| `01-first-feature` | Tasks, creation, complete/reopen, permission declarations and tests |
| `02-task-assignment` | Optional task assignee |
| `03-filtering-pagination` | Title search, status filtering and server pagination |
| `04-task-due-date` | Optional due date, for the new-release deployment exercise |

`main` contains the latest tutorial stage. Each tag points to a complete application. Permissions and roles uses `01-first-feature`; Testing your app and initial deployment use `03-filtering-pagination`. Roles and users are configured through the application UI, not preassigned to every signed-in user.

To start a chapter in a separate directory, select its tag when cloning:

```bash
git clone --branch 01-first-feature https://github.com/nocobase/app-tutorials.git first-feature
cd first-feature
pnpm install --frozen-lockfile
pnpm nocobase config init --dialect sqlite
pnpm nocobase config check
pnpm dev
```

A tag checkout is detached. Create your own branch with `git switch -c my-feature` before editing. Use a separate clone and database for each independent chapter. Moving an existing application's code back to an earlier tag does not roll back its database; do not reset a database to switch chapters. Moving forward applies new migrations while preserving existing data.

Use GitHub Compare to read a chapter's changes, for example [assignment to pagination](https://github.com/nocobase/app-tutorials/compare/02-task-assignment...03-filtering-pagination).

## Verify a feature stage

From `01-first-feature` onward, the tutorial's server and database tests use real isolated SQLite databases:

```bash
pnpm exec vitest run --config vitest.tutorial.config.ts
pnpm typecheck
```

The later chapters also include client tests under `tests/client/`. Run the files relevant to your chapter. Browser tests under `tests/playwright/` use a running application and write test records; use a local or isolated test instance.

```bash
pnpm exec playwright install chromium
APP_URL=http://127.0.0.1:13000/main/ pnpm exec playwright test tests/playwright/tutorial-tasks.test.ts --workers=1
```

Replace `APP_URL` with your actual server entry. If you changed the local administrator, set `TUTORIAL_USERNAME` and `TUTORIAL_PASSWORD` in your environment. Do not commit credentials. Browser tests create temporary ordinary users and permissions, and remove their grants and disable the users afterward.

## Develop with an agent

Read `AGENTS.md` and the application-local Skills under `.agents/skills/`, synchronized during installation. Keep business code in this application, preserve merged migrations, and follow the real permission checks rather than mocking them. The tutorial introduces features incrementally; do not silently add later chapters' fields to earlier tags.

## Deploy

Build from a source checkout and deploy the resulting artifact using the [deployment guides](https://github.com/nocobase/app-docs). A successful build is not a deployment verification. Configure the target explicitly, preserve its configuration and storage, and verify authentication, permissions and persistence after installation or update.
