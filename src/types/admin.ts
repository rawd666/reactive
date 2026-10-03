// Shapes the /api/admin/* routes send back (see server/admin.ts, server/users.ts,
// server/audit.ts and server/db.ts). Kept here rather than imported from server/
// because the browser bundle must never pull in server code.

export type Permission = "clients:read" | "clients:write" | "users:manage" | "audit:read";

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

export interface AuditResponse {
  entries: AuditEntry[];
  hasMore: boolean;
  usernames: string[];
  actions: AuditAction[];
}
