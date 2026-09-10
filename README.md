# bamboohr-cli

Submit BambooHR timesheet clock entries from a JSON file, without pasting the curl by hand each time.

## Setup

Already done for you once — `config.json` holds your session cookie, csrf token,
subdomain (`doodle`) and employee id (`550`), taken from the curl you provided.

**These expire.** When requests start failing with 401/403, open the timesheet page in
Chrome DevTools (Network tab), submit one entry manually, find the `entries` request, and
copy the `Cookie` and `x-csrf-token` header values into `config.json`.

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
