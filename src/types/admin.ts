// Shapes the /api/admin/* routes send back (see server/admin.ts, server/users.ts,
// server/audit.ts and server/db.ts). Kept here rather than imported from server/
// because the browser bundle must never pull in server code.

export type Permission =
  | "clients:read"
  | "clients:write"
  | "calls:read"
  | "users:manage"
  | "audit:read";

export type Role = "master" | "developer" | "telemarketer";

export type UserStatus = "active" | "disabled";

/** A dashboard account, as publicUser() sends it — never includes the password hash. */
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  name: string;
  role: Role;
  permissions: Permission[];
  isMaster: boolean;
  status: UserStatus;
  created_at: string;
  last_login_at: string | null;
}

export type ClientStatus = "active" | "complete" | "cancelled";

/** A clients row plus the support/revision fields decorate() adds. */
export interface Client {
  id: number;
  client_code: string;
  business_name: string | null;
  contact_name: string | null;
  email: string;
  plan_id: string;
  subscription_id: string;
  terms_version: string | null;
  privacy_version: string | null;
  started_at: string;
  support_ends_at: string | null;
  revisions_included: number | null;
  revisions_used: number;
  status: ClientStatus;
  contract_file: string | null;
  contract_agreed: number;
  notes: string | null;
  created_at: string;
  support_days_left: number | null;
  support_active: boolean | null;
  revisions_left: number | null;
}

export type AuditAction =
  | "read"
  | "create"
  | "edit"
  | "delete"
  | "login"
  | "login_failed"
  | "logout";

export interface AuditEntry {
  id: number;
  user_id: number | null;
  username: string;
  action: AuditAction;
  resource: string;
  resource_id: string | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export interface SessionResponse {
  signedIn: boolean;
  seeded: boolean;
  user: AdminUser | null;
}

export interface UsersResponse {
  users: AdminUser[];
  roles: Role[];
  permissions: Permission[];
  rolePermissions: Record<Role, Permission[]>;
}

// --- call logs (server/calls.ts) ---

export interface CallLogEntry {
  id: number;
  user_id: number;
  /** null when the account the call was assigned to has since been deleted. */
  username: string | null;
  caller_name: string;
  export_no: string | null;
  call_id: string | null;
  call_date: string;
  call_time: string | null;
  from_phone: string | null;
  to_phone: string | null;
  duration_seconds: number | null;
  /** 1 recorded, 0 not, null when the export left it blank. */
  recorded: number | null;
  upload_id: number;
}

export interface CallsResponse {
  entries: CallLogEntry[];
  hasMore: boolean;
}

export interface CallUpload {
  id: number;
  filename: string | null;
  uploaded_by_name: string;
  imported_rows: number;
  skipped_rows: number;
  replaced_days: number;
  date_from: string | null;
  date_to: string | null;
  created_at: string;
}

export interface CallerSummary {
  key: string;
  name: string;
  phone: string | null;
  rows: number;
  suggestedUserId: number | null;
  remembered: boolean;
}

export interface DayConflict {
  key: string;
  userId: number;
  username: string;
  date: string;
  existing: number;
  incoming: number;
}

export type Resolution = "replace" | "skip";

export interface CallPreview {
  totalRows: number;
  readableRows: number;
  columns: Record<string, string>;
  missingColumns: string[];
  range: { from: string | null; to: string | null };
  errors: { line: number; message: string }[];
  errorCount: number;
  callers: CallerSummary[];
  conflicts: DayConflict[];
}

export interface CallImportResult {
  uploadId: number;
  imported: number;
  skippedRows: number;
  replacedDays: number;
  skippedDays: number;
}

export interface AuditResponse {
  entries: AuditEntry[];
  hasMore: boolean;
  usernames: string[];
  actions: AuditAction[];
}
