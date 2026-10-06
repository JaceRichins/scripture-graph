Corrected device accounts now refresh the account name, user ID, and family membership from the server before personal sync. The existing device login remains valid.

When an account changes, previous local personal files and annotation queues are preserved in a separate local archive so they cannot be uploaded under the new account. Shared library downloads remain available.

Validation: TypeScript and production build passed. Account transition checks cover preserved login, private-data separation, concurrent refresh, offline handling, and retry after storage errors. Lazy library, reconnect, live sync, and vault sync checks passed.
