#!/usr/bin/env node
// Submits BambooHR timesheet clock entries.
// Usage:
//   node cli.js [entries.json] [--config config.json] [--dry-run]
//   node cli.js --month august [--year 2026] [--dry-run]

import { readFile } from "node:fs/promises";
import path from "node:path";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function parseArgs(argv) {
  const args = {
    entriesFile: "entries.json",
    configFile: "config.json",
    dryRun: false,
    month: null,
    year: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--config") {
      args.configFile = argv[++i];
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--month") {
      args.month = argv[++i];
    } else if (arg === "--year") {
      args.year = Number(argv[++i]);
    } else if (!arg.startsWith("--")) {
      args.entriesFile = arg;
    }
  }
  return args;
}

function resolveMonthIndex(monthArg) {
  const normalized = monthArg.trim().toLowerCase();
  const index = MONTH_NAMES.findIndex(
    (name) => name === normalized || name.startsWith(normalized)
  );
  if (index === -1) {
    console.error(`Unrecognized month "${monthArg}". Use a full or partial name, e.g. "august".`);
    process.exit(1);
  }
  return index;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Generates 9:00-12:00 and 13:00-18:00 entries for every Mon-Fri in the given month.
function generateMonthEntries(monthArg, yearArg) {
  const monthIndex = resolveMonthIndex(monthArg);
  const year = yearArg ?? new Date().getFullYear();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const entries = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, monthIndex, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateStr = `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
    entries.push({ date: dateStr, start: "09:00", end: "12:00", note: "" });
    entries.push({ date: dateStr, start: "13:00", end: "18:00", note: "" });
  }
  return entries;
}

async function loadJson(filePath, exampleName) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(
        `Missing ${filePath}. Copy ${exampleName} to ${path.basename(filePath)} and fill it in.`
      );
      process.exit(1);
    }
    throw err;
  }
}

function validateEntry(entry, index) {
  const errors = [];
  if (!DATE_RE.test(entry.date ?? "")) errors.push(`entry[${index}].date must be YYYY-MM-DD`);
  if (!TIME_RE.test(entry.start ?? "")) errors.push(`entry[${index}].start must be HH:MM`);
  if (!TIME_RE.test(entry.end ?? "")) errors.push(`entry[${index}].end must be HH:MM`);
  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await loadJson(args.configFile, "config.example.json");

  const rawEntries = args.month
    ? generateMonthEntries(args.month, args.year)
    : await loadJson(args.entriesFile, "entries.example.json");

  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    console.error(
      args.month
        ? `No workdays found for ${args.month}${args.year ? " " + args.year : ""}.`
        : `${args.entriesFile} must be a non-empty JSON array of entries.`
    );
    process.exit(1);
  }

  const errors = rawEntries.flatMap(validateEntry);
  if (errors.length > 0) {
    console.error("Invalid entries:\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  const entries = rawEntries.map((entry) => ({
    id: entry.id ?? null,
    trackingId: entry.trackingId ?? null,
    employeeId: entry.employeeId ?? config.employeeId,
    date: entry.date,
    start: entry.start,
    end: entry.end,
    note: entry.note ?? "",
    projectId: entry.projectId ?? null,
    taskId: entry.taskId ?? null,
    breakId: entry.breakId ?? null,
  }));

  const payload = { entries };
  const url = `https://${config.subdomain}.bamboohr.com/timesheet/clock/entries`;

  if (args.dryRun) {
    console.log(`Would POST to ${url}:`);
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8",
      cookie: config.cookie,
      origin: `https://${config.subdomain}.bamboohr.com`,
      referer: `https://${config.subdomain}.bamboohr.com/employees/timesheet/?id=${config.employeeId}`,
      "x-csrf-token": config.csrfToken,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok) {
    console.error(`Request failed: ${response.status} ${response.statusText}`);
    console.error(typeof body === "string" ? body : JSON.stringify(body, null, 2));
    if (response.status === 401 || response.status === 403) {
      console.error(
        "\nThis usually means the cookie/csrf-token in config.json expired. " +
          "Re-open the timesheet page in your browser, copy a fresh 'cookie' and 'x-csrf-token' " +
          "from a network request, and update config.json."
      );
    }
    process.exit(1);
  }

  console.log(`Submitted ${entries.length} entr${entries.length === 1 ? "y" : "ies"} successfully.`);
  console.log(typeof body === "string" ? body : JSON.stringify(body, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
