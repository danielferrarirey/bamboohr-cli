# bamboohr-cli

Submit BambooHR timesheet clock entries from a JSON file, without pasting the curl by hand each time.

## Setup

1. Copy the template: `cp config.example.json config.json` (this file is gitignored —
   it holds your session cookie and csrf token, never commit it).
2. Open your BambooHR timesheet page in Chrome, open DevTools → Network tab, and
   submit or edit any entry manually.
3. Find the `entries` request in the Network tab and copy these values into
   `config.json`:
   - `subdomain` — the part before `.bamboohr.com` in the URL
   - `employeeId` — the `id` query param on the timesheet page URL
   - `cookie` — the full `Cookie` request header
   - `csrfToken` — the `x-csrf-token` request header

**These expire.** When requests start failing with 401/403, repeat steps 2-3 to
refresh `cookie` and `csrfToken` in `config.json`.

## Usage

```bash
# Edit entries.json with the day(s) you want to submit, then:
node apply-timesheet.js

# Preview the payload without sending anything:
node apply-timesheet.js --dry-run

# Use a different entries file:
node apply-timesheet.js my-week.json

# Apply a whole month at once (every weekday, 9am-12pm + 1pm-6pm):
node apply-timesheet.js --month august
node apply-timesheet.js --month august --year 2026   # defaults to current year
node apply-timesheet.js --month aug --dry-run          # abbreviations work too
```

`entries.json` is a JSON array, e.g.:

```json
[
  { "date": "2026-09-02", "start": "13:00", "end": "18:00", "note": "" },
  { "date": "2026-09-03", "start": "09:00", "end": "17:00", "note": "" }
]
```

Each entry accepts optional `id` (set this if you're editing an existing entry rather
than creating a new one), `trackingId`, `projectId`, `taskId`, `breakId` — all default
to `null`/new.

`--month` skips weekends but doesn't know about holidays or PTO — review the
`--dry-run` output and remove/edit entries for any days you didn't actually work.
