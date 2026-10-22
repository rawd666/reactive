// Call logs: telemarketing calls imported from CSV exports by the master admin.
//
// An import is two requests. /calls/preview parses the file and reports what it
// found — the caller names, rows it couldn't read, and date conflicts — without
// writing anything. /calls/import repeats every check inside a transaction and
// only then writes, so a file can't change between the two and slip past them.
//
// Callers are tied to dashboard accounts. A caller is a From Name plus From
// Phone Number pair (see callerKey), and every distinct pair in the file must
// be assigned a user (or explicitly left out). The choice is remembered in
// call_caller_aliases so the next upload pre-fills it.
//
// A date conflict is a (user, day) the file has calls for that the database
// already has calls for too — usually the same export uploaded twice, or a
// corrected one. Each conflicting day must be resolved before the import runs:
// "replace" swaps that day's existing calls for the file's, "skip" keeps the
// existing calls and ignores the file's rows for that day.
//
// Dates are stored as written in the file (YYYY-MM-DD plus HH:MM:SS when there
// is a time), with no timezone conversion: the dialer's local time is the time
// the call was made, and converting it would only invent a timezone.
//
// The file is the phone system's call-history export. Of its columns, only
// those in COLUMNS below are kept; Direction, Call Result, Summary and the rest
// are ignored.

import { db, ensureColumn } from './db.ts';
import { parseCsv } from './csv.ts';
import { listUsers } from './users.ts';
import type { PublicUser } from './users.ts';

db.exec(`
  CREATE TABLE IF NOT EXISTS call_uploads (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    filename         TEXT,
    uploaded_by      INTEGER,
    uploaded_by_name TEXT    NOT NULL,
    imported_rows    INTEGER NOT NULL DEFAULT 0,
    skipped_rows     INTEGER NOT NULL DEFAULT 0,
    replaced_days    INTEGER NOT NULL DEFAULT 0,
    date_from        TEXT,
    date_to          TEXT,
    created_at       TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS call_logs (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL,
    caller_name      TEXT    NOT NULL,
    export_no        TEXT,
    call_id          TEXT,
    call_date        TEXT    NOT NULL,
    call_time        TEXT,
    from_phone       TEXT,
    to_phone         TEXT,
    duration_seconds INTEGER,
    recorded         INTEGER,
    upload_id        INTEGER NOT NULL,
    created_at       TEXT    NOT NULL,
    FOREIGN KEY (upload_id) REFERENCES call_uploads(id)
  );

  CREATE INDEX IF NOT EXISTS idx_calls_user_date ON call_logs (user_id, call_date);
  CREATE INDEX IF NOT EXISTS idx_calls_date      ON call_logs (call_date DESC);

  CREATE TABLE IF NOT EXISTS call_caller_aliases (
    caller_key TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL
  );
`);

// Development databases created before the table matched the phone system's
// export. Their old columns (phone, contact, outcome, notes) are nullable and
// simply go unused.
ensureColumn('call_logs', 'export_no', 'TEXT');
ensureColumn('call_logs', 'call_id', 'TEXT');
ensureColumn('call_logs', 'from_phone', 'TEXT');
ensureColumn('call_logs', 'to_phone', 'TEXT');
ensureColumn('call_logs', 'recorded', 'INTEGER');

const MAX_ROWS = 20000;
const MAX_TEXT = 500;

// An Error the routes turn into a response: `status` is the HTTP status, and a
// 409 carries the conflicts that still need a decision.
export interface CallImportError extends Error {
  status?: number;
  conflicts?: DayConflict[];
}

function fail(message: string, status = 400, conflicts?: DayConflict[]): never {
  const error: CallImportError = new Error(message);
  error.status = status;
  if (conflicts) error.conflicts = conflicts;
  throw error;
}

// --- columns -------------------------------------------------------------

type Field = 'no' | 'callId' | 'caller' | 'fromPhone' | 'toPhone' | 'date' | 'duration' | 'recorded';

// The export's header for each field we keep, compared lower-case with
// everything but letters and digits removed ("From Phone Number" →
// "fromphonenumber"), so spacing, case and punctuation ("NO.") don't matter.
const COLUMNS: Record<Field, string> = {
  no: 'NO.',
  callId: 'Call ID',
  caller: 'From Name', // the dashboard user who made the call
  fromPhone: 'From Phone Number',
  toPhone: 'To Phone Number',
  date: 'Start Time',
  duration: 'Duration',
  recorded: 'Recorded',
};

// Without these a row can't be placed on a day or tied to a user.
const REQUIRED: Field[] = ['caller', 'date'];

function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function detectColumns(headers: string[]): Partial<Record<Field, number>> {
  const normalised = headers.map(normaliseHeader);
  const columns: Partial<Record<Field, number>> = {};
  for (const [field, header] of Object.entries(COLUMNS) as [Field, string][]) {
    const index = normalised.indexOf(normaliseHeader(header));
    if (index !== -1) columns[field] = index;
  }
  return columns;
}

// --- dates ---------------------------------------------------------------

// The export writes Start Time month-first: "10/22/2026 1:24:57 AM". Numeric
// dates are always read that way — never guessed — so 10/05 is October 5th.
// ISO dates ("2026-10-22 01:24:57") are accepted too, in case a file has been
// re-saved from a spreadsheet that rewrote them.
const MDY = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s,]+(.+))?$/;
const YMD = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(.+))?$/;
// Any trailing Z or UTC offset is accepted and ignored — see the file header.
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*([ap])?\.?m?\.?\s*(?:z|[+-]\d{2}:?\d{2})?$/i;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2:05 pm" → "14:05:00"; null when it isn't a time. */
function parseTime(raw: string): string | null {
  const m = TIME.exec(raw.trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const seconds = Number(m[3] ?? 0);
  const meridiem = m[4]?.toLowerCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'p' && hours < 12) hours += 12;
    if (meridiem === 'a' && hours === 12) hours = 0;
  }
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  // Day 0 of the next month is the last day of this one.
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

interface ParsedDate {
  date: string;
  time: string | null;
}

/** "10/22/2026 1:24:57 AM" → { date: "2026-10-22", time: "01:24:57" }; null if unreadable. */
function parseDate(raw: string): ParsedDate | null {
  const value = raw.trim();
  let year: number, month: number, day: number, rest: string | undefined;

  const mdy = MDY.exec(value);
  const ymd = mdy ? null : YMD.exec(value);
  if (mdy) {
    [month, day, year] = [Number(mdy[1]), Number(mdy[2]), Number(mdy[3])];
    rest = mdy[4];
  } else if (ymd) {
    [year, month, day] = [Number(ymd[1]), Number(ymd[2]), Number(ymd[3])];
    rest = ymd[4];
  } else {
    return null;
  }

  if (!isRealDate(year, month, day)) return null;

  let time: string | null = null;
  if (rest) {
    time = parseTime(rest);
    if (!time) return null;
  }
  return { date: `${year}-${pad(month)}-${pad(day)}`, time };
}

const CLOCK_DURATION = /^(?:(\d+):)?(\d{1,2}):(\d{2})$/;
const UNIT_DURATION =
  /^(?:(\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?\s*(?:(\d+)\s*s(?:ec(?:ond)?s?)?)?$/i;

/** "125", "2:05", "00:02:05" or "2m 5s" → seconds; undefined when unreadable. */
function parseDuration(raw: string): number | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d+(\.\d+)?$/.test(value)) return Math.round(Number(value));
  const clock = CLOCK_DURATION.exec(value);
  if (clock) return Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
  const units = UNIT_DURATION.exec(value);
  // The pattern also matches "", so insist that at least one unit was there.
  if (units && (units[1] || units[2] || units[3])) {
    return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0);
  }
  return undefined;
}

/**
 * The Recorded column → 1 / 0, or null when blank. Anything that isn't a
 * clear "no" counts as recorded, since some exports put a recording link or
 * id there instead of "Yes".
 */
function parseRecorded(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  return /^(no|n|false|0|-|none)$/i.test(value) ? 0 : 1;
}

// --- parsing a file ------------------------------------------------------

interface CallRow {
  line: number;
  callerName: string;
  callerKey: string;
  exportNo: string | null;
  callId: string | null;
  date: string;
  time: string | null;
  fromPhone: string | null;
  toPhone: string | null;
  duration: number | null;
  recorded: number | null;
}

export interface RowError {
  line: number;
  message: string;
}

interface ParsedFile {
  rows: CallRow[];
  errors: RowError[];
  columns: Partial<Record<Field, string>>;
}

/** Names match regardless of case and spacing: "Sam  Lee" is "sam lee". */
function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Numbers match on their digits alone: "+971 50-123" is "97150123". */
function normalisePhone(phone: string | null): string {
  return (phone ?? '').replace(/\D/g, '');
}

/**
 * A caller is a From Name *and* a From Phone Number. The same number under a
 * different name — or the same name on a different number — is a different
 * caller, assigned to a user (and remembered) separately.
 */
function callerKey(name: string, phone: string | null): string {
  return `${normaliseName(name)}|${normalisePhone(phone)}`;
}

function text(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed.slice(0, MAX_TEXT) : null;
}

function parseCallFile(csv: string): ParsedFile {
  const table = parseCsv(csv);
  if (table.length < 2) fail('The file has a header row but no calls.');
  if (table.length - 1 > MAX_ROWS) {
    fail(`The file has ${table.length - 1} rows; split it into files of at most ${MAX_ROWS}.`);
  }

  const [headers, ...data] = table;
  const columns = detectColumns(headers);
  const missing = REQUIRED.filter((f) => columns[f] === undefined);
  if (missing.length) {
    fail(
      `Couldn't find the ${missing.map((f) => `"${COLUMNS[f]}"`).join(' or ')} column. ` +
        `Headers in the file: ${headers.map((h) => h.trim() || '(blank)').join(', ')}.`
    );
  }

  const get = (row: string[], field: Field) =>
    columns[field] === undefined ? '' : (row[columns[field]] ?? '');

  const rows: CallRow[] = [];
  const errors: RowError[] = [];

  data.forEach((row, i) => {
    const line = i + 2; // 1-based, after the header
    const callerName = get(row, 'caller').trim().replace(/\s+/g, ' ');
    if (!callerName) {
      errors.push({ line, message: `no ${COLUMNS.caller}` });
      return;
    }

    const rawDate = get(row, 'date').trim();
    const parsed = parseDate(rawDate);
    if (!parsed) {
      errors.push({
        line,
        message: rawDate
          ? `${COLUMNS.date} "${rawDate}" isn't MM/DD/YYYY h:mm:ss AM`
          : `no ${COLUMNS.date}`,
      });
      return;
    }

    const duration = parseDuration(get(row, 'duration'));
    if (duration === undefined) {
      errors.push({ line, message: `unrecognised duration "${get(row, 'duration').trim()}"` });
      return;
    }

    const fromPhone = text(get(row, 'fromPhone'));
    rows.push({
      line,
      callerName,
      callerKey: callerKey(callerName, fromPhone),
      exportNo: text(get(row, 'no')),
      callId: text(get(row, 'callId')),
      date: parsed.date,
      time: parsed.time,
      fromPhone,
      toPhone: text(get(row, 'toPhone')),
      duration,
      recorded: parseRecorded(get(row, 'recorded')),
    });
  });

  const columnNames: Partial<Record<Field, string>> = {};
  for (const [field, index] of Object.entries(columns) as [Field, number][]) {
    columnNames[field] = headers[index].trim();
  }

  return { rows, errors, columns: columnNames };
}

// --- callers -------------------------------------------------------------

export interface CallerSummary {
  key: string;
  name: string;
  /** From Phone Number as first written in the file; null when blank. */
  phone: string | null;
  rows: number;
  suggestedUserId: number | null;
  /** True when the suggestion is a mapping saved by an earlier upload. */
  remembered: boolean;
}

function summariseCallers(rows: CallRow[], users: PublicUser[]): CallerSummary[] {
  const byKey = new Map<string, CallerSummary>();
  for (const row of rows) {
    const existing = byKey.get(row.callerKey);
    if (existing) existing.rows++;
    else
      byKey.set(row.callerKey, {
        key: row.callerKey,
        name: row.callerName,
        phone: row.fromPhone,
        rows: 1,
        suggestedUserId: null,
        remembered: false,
      });
  }

  const ids = new Set(users.map((u) => u.id));
  const alias = db.prepare('SELECT user_id FROM call_caller_aliases WHERE caller_key = ?');
  for (const caller of byKey.values()) {
    const saved = alias.get(caller.key) as { user_id: number } | undefined;
    if (saved && ids.has(saved.user_id)) {
      caller.suggestedUserId = saved.user_id;
      caller.remembered = true;
      continue;
    }
    // Otherwise a dashboard account whose username or full name matches the
    // From Name. Only a suggestion: each number still has to be confirmed.
    const name = normaliseName(caller.name);
    const match = users.find(
      (u) => normaliseName(u.username) === name || (u.name && normaliseName(u.name) === name)
    );
    caller.suggestedUserId = match ? match.id : null;
  }

  return [...byKey.values()].sort((a, b) => b.rows - a.rows);
}

/**
 * Cleans the caller → user mapping from the request body. A number assigns the
 * caller to that account; null means "don't import this caller's rows".
 * Callers the mapping doesn't mention are left out of the result.
 */
function readMapping(raw: unknown, users: PublicUser[]): Map<string, number | null> {
  const mapping = new Map<string, number | null>();
  if (!raw || typeof raw !== 'object') return mapping;
  const ids = new Set(users.map((u) => u.id));
  for (const [key, value] of Object.entries(raw)) {
    if (value === null) mapping.set(key, null);
    else if (typeof value === 'number' && ids.has(value)) mapping.set(key, value);
  }
  return mapping;
}

// --- conflicts -----------------------------------------------------------

export interface DayConflict {
  /** `${userId}|${date}` — what the import request uses to resolve it. */
  key: string;
  userId: number;
  username: string;
  date: string;
  existing: number;
  incoming: number;
}

export type Resolution = 'replace' | 'skip';

interface AssignedRow extends CallRow {
  userId: number;
}

function assign(rows: CallRow[], mapping: Map<string, number | null>): AssignedRow[] {
  const assigned: AssignedRow[] = [];
  for (const row of rows) {
    const userId = mapping.get(row.callerKey);
    if (typeof userId === 'number') assigned.push({ ...row, userId });
  }
  return assigned;
}

function dayKey(userId: number, date: string) {
  return `${userId}|${date}`;
}

function findConflicts(rows: AssignedRow[], users: PublicUser[]): DayConflict[] {
  const incoming = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(row.userId, row.date);
    incoming.set(key, (incoming.get(key) ?? 0) + 1);
  }

  const names = new Map(users.map((u) => [u.id, u.username]));
  const count = db.prepare('SELECT COUNT(*) AS n FROM call_logs WHERE user_id = ? AND call_date = ?');
  const conflicts: DayConflict[] = [];
  for (const [key, n] of incoming) {
    const [userId, date] = [Number(key.split('|')[0]), key.split('|')[1]];
    const { n: existing } = count.get(userId, date) as { n: number };
    if (existing > 0) {
      conflicts.push({
        key,
        userId,
        username: names.get(userId) ?? `user ${userId}`,
        date,
        existing,
        incoming: n,
      });
    }
  }
  return conflicts.sort((a, b) => a.date.localeCompare(b.date) || a.username.localeCompare(b.username));
}

function dateRange(rows: { date: string }[]): { from: string | null; to: string | null } {
  if (!rows.length) return { from: null, to: null };
  const dates = rows.map((r) => r.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

// --- preview & import ----------------------------------------------------

export interface PreviewResult {
  totalRows: number;
  readableRows: number;
  columns: Partial<Record<Field, string>>;
  /** Expected export headers the file doesn't have; those fields stay blank. */
  missingColumns: string[];
  range: { from: string | null; to: string | null };
  errors: RowError[];
  errorCount: number;
  callers: CallerSummary[];
  conflicts: DayConflict[];
}

/** Everything the uploader needs to decide on, with nothing written. */
export function previewCalls(csv: string, rawMapping: unknown): PreviewResult {
  const parsed = parseCallFile(csv);
  const users = listUsers();
  const callers = summariseCallers(parsed.rows, users);

  // Conflicts follow the mapping the uploader has chosen so far, falling back
  // to the suggestion for callers they haven't touched — so the first preview
  // already shows the conflicts the suggested mapping would cause.
  const mapping = readMapping(rawMapping, users);
  for (const caller of callers) {
    if (!mapping.has(caller.key) && caller.suggestedUserId !== null) {
      mapping.set(caller.key, caller.suggestedUserId);
    }
  }

  return {
    totalRows: parsed.rows.length + parsed.errors.length,
    readableRows: parsed.rows.length,
    columns: parsed.columns,
    missingColumns: (Object.keys(COLUMNS) as Field[])
      .filter((f) => !parsed.columns[f])
      .map((f) => COLUMNS[f]),
    range: dateRange(parsed.rows),
    errors: parsed.errors.slice(0, 50),
    errorCount: parsed.errors.length,
    callers,
    conflicts: findConflicts(assign(parsed.rows, mapping), users),
  };
}

export interface ImportRequest {
  csv: string;
  mapping: unknown;
  resolutions: unknown;
  filename: string | null;
  uploader: PublicUser;
}

export interface ImportResult {
  uploadId: number;
  imported: number;
  skippedRows: number;
  replacedDays: number;
  skippedDays: number;
}

export function importCalls({ csv, mapping: rawMapping, resolutions: rawResolutions, filename, uploader }: ImportRequest): ImportResult {
  const parsed = parseCallFile(csv);
  const users = listUsers();
  const mapping = readMapping(rawMapping, users);

  const unassigned = summariseCallers(parsed.rows, users).filter((c) => !mapping.has(c.key));
  if (unassigned.length) {
    fail(
      `Assign a user to every ${COLUMNS.caller} first ` +
        `(missing: ${unassigned.map((c) => c.name).join(', ')}).`
    );
  }

  const resolutions = new Map<string, Resolution>();
  if (rawResolutions && typeof rawResolutions === 'object') {
    for (const [key, value] of Object.entries(rawResolutions)) {
      if (value === 'replace' || value === 'skip') resolutions.set(key, value);
    }
  }

  const rows = assign(parsed.rows, mapping);

  // IMMEDIATE takes the write lock now, so no other import can add calls
  // between checking for conflicts and writing.
  db.exec('BEGIN IMMEDIATE');
  try {
    const conflicts = findConflicts(rows, users);
    const unresolved = conflicts.filter((c) => !resolutions.has(c.key));
    if (unresolved.length) {
      fail(
        `${unresolved.length} day(s) already have calls logged. Choose replace or skip for each.`,
        409,
        unresolved
      );
    }

    const replace = conflicts.filter((c) => resolutions.get(c.key) === 'replace');
    const skip = new Set(conflicts.filter((c) => resolutions.get(c.key) === 'skip').map((c) => c.key));
    const toInsert = rows.filter((row) => !skip.has(dayKey(row.userId, row.date)));
    const range = dateRange(toInsert);
    const now = new Date().toISOString();

    const upload = db
      .prepare(
        `INSERT INTO call_uploads
           (filename, uploaded_by, uploaded_by_name, imported_rows, skipped_rows,
            replaced_days, date_from, date_to, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        filename,
        uploader.id,
        uploader.username,
        toInsert.length,
        parsed.rows.length + parsed.errors.length - toInsert.length,
        replace.length,
        range.from,
        range.to,
        now
      );
    const uploadId = Number(upload.lastInsertRowid);

    const remove = db.prepare('DELETE FROM call_logs WHERE user_id = ? AND call_date = ?');
    for (const conflict of replace) remove.run(conflict.userId, conflict.date);

    const insert = db.prepare(
      `INSERT INTO call_logs
         (user_id, caller_name, export_no, call_id, call_date, call_time, from_phone,
          to_phone, duration_seconds, recorded, upload_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const row of toInsert) {
      insert.run(
        row.userId,
        row.callerName,
        row.exportNo,
        row.callId,
        row.date,
        row.time,
        row.fromPhone,
        row.toPhone,
        row.duration,
        row.recorded,
        uploadId,
        now
      );
    }

    // Remember who each caller is, for the next upload. Callers deliberately
    // left out aren't remembered, so they come up unassigned again.
    const remember = db.prepare(
      'INSERT OR REPLACE INTO call_caller_aliases (caller_key, user_id) VALUES (?, ?)'
    );
    for (const [key, userId] of mapping) if (userId !== null) remember.run(key, userId);

    db.exec('COMMIT');

    return {
      uploadId,
      imported: toInsert.length,
      skippedRows: parsed.rows.length + parsed.errors.length - toInsert.length,
      replacedDays: replace.length,
      skippedDays: skip.size,
    };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// --- reading -------------------------------------------------------------

// Row shapes are type aliases, not interfaces, so node:sqlite's
// Record<string, SQLOutputValue> results can be cast to them (as in db.ts).
export type CallLogRow = {
  id: number;
  user_id: number;
  username: string | null;
  caller_name: string;
  call_date: string;
  export_no: string | null;
  call_id: string | null;
  call_time: string | null;
  from_phone: string | null;
  to_phone: string | null;
  duration_seconds: number | null;
  /** 1 recorded, 0 not, null when the export left it blank. */
  recorded: number | null;
  upload_id: number;
};

// Filter values arrive straight from the query string, hence the loose types.
export interface CallFilter {
  limit?: unknown;
  offset?: unknown;
  userId?: number | null;
  from?: string;
  to?: string;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Newest calls first, with optional filters; hasMore as in listAudit(). */
export function listCalls(
  { limit = 100, offset = 0, userId, from, to }: CallFilter = {}
): { entries: CallLogRow[]; hasMore: boolean } {
  const where: string[] = [];
  const values: (string | number)[] = [];

  if (typeof userId === 'number') {
    where.push('c.user_id = ?');
    values.push(userId);
  }
  if (from && ISO_DAY.test(from)) {
    where.push('c.call_date >= ?');
    values.push(from);
  }
  if (to && ISO_DAY.test(to)) {
    where.push('c.call_date <= ?');
    values.push(to);
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const capped = Math.min(Math.max(Number(limit) || 100, 1), 500);

  const rows = db
    .prepare(
      `SELECT c.id, c.user_id, u.username, c.caller_name, c.export_no, c.call_id, c.call_date,
              c.call_time, c.from_phone, c.to_phone, c.duration_seconds, c.recorded, c.upload_id
         FROM call_logs c LEFT JOIN admin_users u ON u.id = c.user_id
         ${clause}
        ORDER BY c.call_date DESC, c.call_time DESC, c.id DESC
        LIMIT ? OFFSET ?`
    )
    .all(...values, capped + 1, Math.max(Number(offset) || 0, 0)) as CallLogRow[];

  const hasMore = rows.length > capped;
  return { entries: hasMore ? rows.slice(0, capped) : rows, hasMore };
}

export type CallUploadRow = {
  id: number;
  filename: string | null;
  uploaded_by_name: string;
  imported_rows: number;
  skipped_rows: number;
  replaced_days: number;
  date_from: string | null;
  date_to: string | null;
  created_at: string;
};

export function recentUploads(limit = 10): CallUploadRow[] {
  return db
    .prepare('SELECT * FROM call_uploads ORDER BY id DESC LIMIT ?')
    .all(limit) as CallUploadRow[];
}
