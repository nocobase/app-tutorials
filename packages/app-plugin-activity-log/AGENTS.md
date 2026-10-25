# Tutorial plugin

This directory is an independently packaged NocoBase 3 plugin, explicitly requested for the plugin development tutorial. Application-only instructions at the repository root do not prohibit work here. Keep public interfaces in the manifest exports; the root application consumes those exports and owns business pages and calls. Use the exact published Core versions in this package and the workspace lockfile when validating; do not introduce dependencies on a NocoBase source checkout.

The application-owned tests exercise task integration; plugin-owned tests live under `tests/` and register a minimal real host. Run this package's lint, typecheck, tests and build after changes, plus affected host tests. Keep migrations immutable after merge. Client text belongs in the package's locale resources; maintain all ten declared languages. Tutorial prose may be authored in Chinese first, while source comments, logs and sample data remain English.

Never grant activity-log access to all authenticated users as a side effect of installation. The host assigns explicit page and API grants to its readers. Record only server-authorized business operations through the original service token; use the caller's database transaction for atomic business and activity writes.
