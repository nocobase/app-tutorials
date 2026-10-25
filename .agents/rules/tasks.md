# Team task application

Tasks are application-owned code, with title, description, assignee, calendar due date and todo/inProgress/done status. The feature uses the existing DataTable, route overlays, form fields and semantic theme tokens. User identities are read through the Authentication public user administration service; never query plugin-owned user tables.

Task permissions separate read, create, edit, progress and delete. Every service operation uses the granted RepositoryPolicy. Members can read and advance only assigned tasks; readers cannot write. The three required business roles are seeded but assigned only to explicitly chosen users through Users. Local demonstration accounts and tasks never belong in required seeds.

Updating details, progress or deletion checks the last observed updatedAt in the database write predicate. Progress never changes ownership or task details. Successful writes update local state before reloading; a failed refresh must not invite duplicate submission. Task action menus are non-modal to cooperate with route overlays.

Use tests/server/tasks.test.ts and tests/database/tasks.test.ts for real application and database checks. Run tests/playwright/tasks.test.ts against a separate running test instance, with APP_URL, TUTORIAL_USERNAME and TUTORIAL_PASSWORD. That suite creates and removes tasks and intercepts requests only to reproduce network failures and pending saves.

The screenshots in documentation show local demonstration data. A clone and deployment create an empty task list with business role definitions, not the author's users or task records.
