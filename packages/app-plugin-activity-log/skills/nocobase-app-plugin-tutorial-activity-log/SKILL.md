---
name: nocobase-app-plugin-tutorial-activity-log
description: Record application operations and display the activity log using the tutorial plugin. Use when integrating its public service, page or component, configuring pagination, or diagnosing access. Do not use it as an automatic audit trail or import its private storage.
---

# Activity log integration

Register the Client, Server and CLI entries through `nocobase plugin register @nocobase/app-plugin-tutorial-activity-log --no-install` after installing the package. Add `defineActivityLogConfig()` from `@nocobase/app-plugin-tutorial-activity-log/config` under `activityLog` in the application's configuration map. Registration alone does not install that configuration factory.

Import `activityLogToken` from `@nocobase/app-plugin-tutorial-activity-log/server`. Resolve it from the server container. Call `record({ actorId, action, subject, summary }, connection)` only after authenticating and authorizing the business operation; take `actorId` from the verified session, never from request input. Pass the caller's transaction connection when the business write and record must commit together. The plugin does not observe database writes automatically and is not an immutable compliance audit log.

The plugin owns `tutorialActivityRecords`; application code must not write that collection directly. The application owns business records, invocation timing and user role assignments. The public service is a trusted in-process API, not an HTTP authorization boundary. Do not store credentials or full request bodies in records.

The plugin contributes `/activity-log`, with page permission `page:activity-log` / `access`. Its `GET /api/activityLog/records` independently requires `activityLog:all` / `read`; this grant can read all recorded operations in the application. Grant both to explicitly selected readers. A menu or page grant alone does not grant API access. The endpoint accepts `page` (1–1000000) and `pageSize` (1–100) and returns `{ data, meta: { total, page, pageSize } }`.

For an application-owned presentation import `ActivityLog` from `@nocobase/app-plugin-tutorial-activity-log/client/components`. Register the Client plugin to provide its service, React preferences and locale resources. Client registration accepts `{ pageSize: 10 }`; Server `activityLog.pageSize` is the default only when a caller omits `pageSize`. Use the exported `activityLogRouteId` for a component override rather than declaring a duplicate route.

Verify by creating a task in the tutorial host, opening Activity log and locating its `task.created` entry. A signed-in user without the read grant must receive 403 from the API. `pnpm nocobase tutorial-activity-log count --json` reports a count using the configured server runtime; CLI access assumes an operator who can access the application's configuration and database. This plugin exports no public write endpoint and does not grant roles automatically.
