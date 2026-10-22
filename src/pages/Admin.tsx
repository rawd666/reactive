import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, ComponentType, FormEvent } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Users, UserCog, ScrollText, LogOut, Trash2, Plus, PhoneCall } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Seo from "../components/common/Seo";
import type {
  AdminUser,
  AuditResponse,
  CallImportResult,
  CallPreview,
  CallsResponse,
  CallUpload,
  Client,
  Resolution,
  ClientStatus,
  Permission,
  Role,
  SessionResponse,
  UserStatus,
  UsersResponse,
} from "../types/admin";

// Owner-only dashboard. Nothing here is secret on its own — the protection is
// server-side: every /api/admin/* route checks the signed-in user's permissions
// and returns 401/403 on its own. This page just renders what the API is
// willing to hand over, and hides the menu items it would refuse anyway.
//
// Layout: a left-hand menu (SECTIONS, further down) beside the active panel.
// Each section is its own route under /admin, so a section can be linked to,
// reloaded, and reached with the back button.

// Props every section panel receives from the dashboard's router.
interface PanelProps {
  me: AdminUser;
  onSignedOut: () => void;
}

// An Error that also carries the HTTP status the API answered with.
interface ApiError extends Error {
  status?: number;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function can(user: AdminUser | null, permission: Permission) {
  if (!user) return false;
  return user.isMaster || user.permissions.includes(permission);
}

// Turns "clients:write" into "clients · write" for the permission checkboxes.
function permissionLabel(permission: Permission) {
  return permission.replace(":", " · ");
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error: ApiError = new Error(data.error || `Request failed (${res.status})`);
    // The status rides along so callers can tell "session expired" (401) from
    // "you're not allowed" (403) — the server's message alone doesn't say.
    error.status = res.status;
    throw error;
  }
  return data;
}

interface LoginProps {
  onSignedIn: (user: AdminUser) => void;
  seeded: boolean;
}

function Login({ onSignedIn, seeded }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Sign-in failed");
      onSignedIn(data.user);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "0 auto" }}>
      <div className="rx-eyebrow">restricted</div>
      <h1 className="rx-h2" style={{ marginBottom: 20 }}>
        Sign in
      </h1>
      <form onSubmit={submit} className="rx-form">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoFocus
          autoComplete="username"
          disabled={busy}
          style={{ marginBottom: 12 }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          disabled={busy}
        />
        {seeded && (
          <p style={{ fontSize: 13, marginTop: 12, opacity: 0.7 }}>
            Seeded login: <code>admin</code> / <code>change-me-in-env</code> — set
            ADMIN_USER and ADMIN_PASSWORD in .env to replace it.
          </p>
        )}
        {error && (
          <p style={{ color: "var(--color-pink)", fontSize: 14, marginTop: 12 }}>{error}</p>
        )}
        <button
          type="submit"
          className="rx-btn rx-btn-primary"
          style={{ marginTop: 16 }}
          disabled={busy || !username || !password}
        >
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

interface ClientRowProps {
  client: Client;
  onChange: (client: Client) => void;
}

function ClientRow({ client, onChange }: ClientRowProps) {
  const [business, setBusiness] = useState(client.business_name || "");
  const [saving, setSaving] = useState(false);

  async function patch(body: { business_name?: string; status?: ClientStatus }) {
    setSaving(true);
    const res = await fetch(`/api/admin/clients/${client.client_code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onChange((await res.json()).client);
  }

  async function addRevision() {
    setSaving(true);
    const res = await fetch(`/api/admin/clients/${client.client_code}/revision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ detail: "logged from admin" }),
    });
    setSaving(false);
    if (res.ok) onChange((await res.json()).client);
  }

  const revisions =
    client.revisions_included === null
      ? `${client.revisions_used} (unlimited)`
      : `${client.revisions_used} / ${client.revisions_included}`;

  const overRevisions =
    client.revisions_included !== null && client.revisions_used > client.revisions_included;

  return (
    <tr>
      <td className="rx-mono" style={{ whiteSpace: "nowrap" }}>{client.client_code}</td>
      <td>
        <input
          value={business}
          onChange={(e) => setBusiness(e.target.value)}
          onBlur={() => {
            if (business !== (client.business_name || "")) patch({ business_name: business });
          }}
          placeholder="Business name"
          style={{ width: "100%", minWidth: 140 }}
        />
      </td>
      <td style={{ fontSize: 13 }}>
        {client.contact_name || "—"}
        <br />
        <span style={{ color: "var(--color-gray-mid)" }}>{client.email}</span>
      </td>
      <td style={{ textTransform: "capitalize" }}>{client.plan_id}</td>
      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(client.started_at)}</td>
      <td style={{ whiteSpace: "nowrap" }}>
        {fmtDate(client.support_ends_at)}
        <br />
        <span
          style={{
            fontSize: 12,
            color: client.support_active ? "var(--color-gray-mid)" : "var(--color-pink)",
          }}
        >
          {client.support_days_left === null
            ? ""
            : client.support_days_left > 0
              ? `${client.support_days_left} days left`
              : "expired"}
        </span>
      </td>
      <td style={{ color: overRevisions ? "var(--color-pink)" : undefined }}>{revisions}</td>
      <td>
        <select
          value={client.status}
          onChange={(e) => patch({ status: e.target.value as ClientStatus })}
          disabled={saving}
        >
          <option value="active">active</option>
          <option value="complete">complete</option>
          <option value="cancelled">cancelled</option>
        </select>
      </td>
      <td>
        <button
          className="rx-btn rx-btn-outline"
          style={{ padding: "6px 12px", fontSize: 13 }}
          onClick={addRevision}
          disabled={saving}
        >
          + revision
        </button>
      </td>
    </tr>
  );
}

// Heading every panel opens with, so sections stay visually consistent.
function PanelHeading({ title, note }: { title: string; note?: string }) {
  return (
    <header className="rx-admin-panel-head">
      <h1 className="rx-h2">{title}</h1>
      {note && <p className="rx-admin-panel-note">{note}</p>}
    </header>
  );
}

function ClientsPanel({ onSignedOut }: Pick<PanelProps, "onSignedOut">) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [error, setError] = useState("");

  // State is set inside the promise callbacks rather than synchronously in the
  // effect body, which is what react-hooks/set-state-in-effect asks for. The
  // cancelled flag stops a late response writing to an unmounted component.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/clients")
      .then(async (res) => {
        if (res.status === 401) {
          if (!cancelled) onSignedOut();
          return;
        }
        const data: { clients: Client[] } = await res.json();
        if (!cancelled) setClients(data.clients);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load clients.");
      });

    return () => {
      cancelled = true;
    };
  }, [onSignedOut]);

  function replace(updated: Client) {
    setClients((prev) =>
      prev && prev.map((c) => (c.client_code === updated.client_code ? updated : c))
    );
  }

  return (
    <>
      <PanelHeading
        title="Clients"
        note="Every business with a subscription — current and past."
      />

      {error && <p style={{ color: "var(--color-pink)", marginTop: 24 }}>{error}</p>}

      {clients === null && !error && (
        <p style={{ marginTop: 24 }}>Loading…</p>
      )}

      {clients?.length === 0 && (
        <p style={{ marginTop: 24 }}>
          No clients yet. A business appears here automatically when a subscription is
          confirmed at checkout.
        </p>
      )}

      {clients && clients.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 32 }}>
          <table className="rx-admin-table">
            <thead>
              <tr>
                <th>Client ID</th>
                <th>Business</th>
                <th>Contact</th>
                <th>Plan</th>
                <th>Started</th>
                <th>Support ends</th>
                <th>Revisions</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <ClientRow key={c.client_code} client={c} onChange={replace} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// --- users (master only) -------------------------------------------------

interface NewUserFormProps {
  roles: Role[];
  onCreated: (user: AdminUser) => void;
}

interface NewUserFields {
  username: string;
  email: string;
  name: string;
  role: Role;
  password: string;
}

function NewUserForm({ roles, onCreated }: NewUserFormProps) {
  const blank: NewUserFields = { username: "", email: "", name: "", role: "telemarketer", password: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set =
    (key: keyof NewUserFields) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api<{ user: AdminUser }>("/users", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(blank);
      onCreated(user);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="rx-admin-newuser">
      <input value={form.username} onChange={set("username")} placeholder="Username" required />
      <input value={form.email} onChange={set("email")} type="email" placeholder="Email" />
      <input value={form.name} onChange={set("name")} placeholder="Full name" />
      <select value={form.role} onChange={set("role")}>
        {roles
          .filter((r) => r !== "master")
          .map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
      </select>
      <input
        value={form.password}
        onChange={set("password")}
        type="password"
        placeholder="Password (10+ chars)"
        autoComplete="new-password"
        required
      />
      <button type="submit" className="rx-btn rx-btn-outline rx-admin-add" disabled={busy}>
        <Plus size={15} aria-hidden="true" />
        {busy ? "Adding…" : "Add user"}
      </button>
      {error && <p className="rx-admin-error">{error}</p>}
    </form>
  );
}

interface UserRowProps {
  user: AdminUser;
  permissions: Permission[];
  onChange: (user: AdminUser) => void;
  onDelete: (id: number) => void;
  isSelf: boolean;
}

interface UserPatch {
  role?: Role;
  status?: UserStatus;
  permissions?: Permission[];
}

function UserRow({ user, permissions, onChange, onDelete, isSelf }: UserRowProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function patch(body: UserPatch) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ user: AdminUser }>(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChange(data.user);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  function togglePermission(permission: Permission) {
    const next = user.permissions.includes(permission)
      ? user.permissions.filter((p) => p !== permission)
      : [...user.permissions, permission];
    patch({ permissions: next });
  }

  async function remove() {
    if (!window.confirm(`Delete ${user.username}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/users/${user.id}`, { method: "DELETE" });
      onDelete(user.id);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <tr>
      <td>
        <span className="rx-mono">{user.username}</span>
        {user.isMaster && <span className="rx-admin-tag">master</span>}
        {isSelf && <span className="rx-admin-tag muted">you</span>}
        {error && <p className="rx-admin-error">{error}</p>}
      </td>
      <td style={{ fontSize: 13 }}>
        {user.email || "—"}
        {user.name && (
          <>
            <br />
            <span style={{ color: "var(--color-gray-mid)" }}>{user.name}</span>
          </>
        )}
      </td>
      <td>
        {user.isMaster ? (
          <span style={{ textTransform: "capitalize" }}>{user.role}</span>
        ) : (
          <select
            value={user.role}
            onChange={(e) => patch({ role: e.target.value as Role })}
            disabled={busy}
          >
            <option value="developer">developer</option>
            <option value="telemarketer">telemarketer</option>
          </select>
        )}
      </td>
      <td>
        <div className="rx-admin-perms">
          {permissions.map((permission) => (
            <label key={permission} title={permission}>
              <input
                type="checkbox"
                checked={user.permissions.includes(permission)}
                onChange={() => togglePermission(permission)}
                disabled={busy || user.isMaster}
              />
              {permissionLabel(permission)}
            </label>
          ))}
        </div>
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {user.isMaster ? (
          <span style={{ color: "var(--color-gray-mid)" }}>active</span>
        ) : (
          <select
            value={user.status}
            onChange={(e) => patch({ status: e.target.value as UserStatus })}
            disabled={busy}
          >
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        )}
      </td>
      <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>{fmtDateTime(user.last_login_at)}</td>
      <td>
        {!user.isMaster && !isSelf && (
          <button
            className="rx-admin-iconbtn"
            onClick={remove}
            disabled={busy}
            title={`Delete ${user.username}`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </td>
    </tr>
  );
}

function UsersPanel({ me, onSignedOut }: PanelProps) {
  const [state, setState] = useState<UsersResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<UsersResponse>("/users")
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.status === 401) onSignedOut();
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [onSignedOut]);

  function replace(user: AdminUser) {
    setState((s) => s && { ...s, users: s.users.map((u) => (u.id === user.id ? user : u)) });
  }

  return (
    <>
      <PanelHeading
        title="Users"
        note="Everyone who can sign in to this dashboard. Only the master admin sees this."
      />

      {error && <p className="rx-admin-error" style={{ marginTop: 24 }}>{error}</p>}
      {!state && !error && <p style={{ marginTop: 24 }}>Loading…</p>}

      {state && (
        <>
          <div style={{ overflowX: "auto", marginTop: 28 }}>
            <table className="rx-admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    permissions={state.permissions}
                    isSelf={user.id === me.id}
                    onChange={replace}
                    onDelete={(id) =>
                      setState((s) => s && { ...s, users: s.users.filter((u) => u.id !== id) })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="rx-h3" style={{ marginTop: 40, marginBottom: 14 }}>
            Add a user
          </h2>
          <NewUserForm
            roles={state.roles}
            onCreated={(user) => setState((s) => s && { ...s, users: [...s.users, user] })}
          />
          <p className="rx-admin-note">
            The master account is set by ADMIN_USER / ADMIN_PASSWORD in .env and can&apos;t be
            edited here — that way a lockout is always fixable from the server.
          </p>
        </>
      )}
    </>
  );
}

// --- call logs -----------------------------------------------------------
// The master uploads dialer CSV exports; everyone with calls:read sees the log
// (non-master accounts only their own calls — the server enforces that).

// "2026-10-20" → "Oct 20, 2026", read as a local date. new Date("2026-10-20")
// would be UTC midnight, which shows as the day before west of Greenwich.
function fmtDay(day: string | null) {
  if (!day) return "—";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDuration(seconds: number | null) {
  if (seconds === null) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// From Name (normalised) → user id. undefined = not decided yet; null = leave
// that name's rows out of the import.
type CallerMapping = Record<string, number | null | undefined>;

interface CallUploadFormProps {
  users: AdminUser[];
  onImported: () => void;
}

function CallUploadForm({ users, onImported }: CallUploadFormProps) {
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<CallPreview | null>(null);
  const [mapping, setMapping] = useState<CallerMapping>({});
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  // Every preview bumps this; a response that isn't the latest is dropped, so
  // quickly changing two names can't leave the older answer on screen.
  const latest = useRef(0);

  // Asks the server to parse the file and report From Names and conflicts.
  // `fresh` (a new file) starts the mapping over from the server's
  // suggestions; otherwise the uploader's choices are kept.
  async function check(text: string, chosen: CallerMapping, fresh: boolean) {
    const request = ++latest.current;
    setBusy(true);
    setError("");
    try {
      const data = await api<CallPreview>("/calls/preview", {
        method: "POST",
        // Undecided names (undefined) drop out of the JSON, so the server
        // falls back to its suggestion for them when looking for conflicts.
        body: JSON.stringify({ csv: text, mapping: chosen }),
      });
      if (request !== latest.current) return;
      setPreview(data);
      if (fresh) {
        const initial: CallerMapping = {};
        for (const caller of data.callers) {
          if (caller.suggestedUserId !== null) initial[caller.key] = caller.suggestedUserId;
        }
        setMapping(initial);
        setResolutions({});
      }
    } catch (err) {
      if (request !== latest.current) return;
      setPreview(null);
      setError((err as Error).message);
    }
    if (request === latest.current) setBusy(false);
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    setDone("");
    if (!chosen) return;
    const text = await chosen.text();
    setFile({ name: chosen.name, text });
    check(text, {}, true);
  }

  function assignCaller(key: string, value: string) {
    const next = { ...mapping, [key]: value === "skip" ? null : Number(value) };
    setMapping(next);
    if (file) check(file.text, next, false);
  }

  function resolveAll(resolution: Resolution) {
    if (!preview) return;
    setResolutions(Object.fromEntries(preview.conflicts.map((c) => [c.key, resolution])));
  }

  function reset() {
    latest.current++; // drop any preview still in flight
    setFile(null);
    setPreview(null);
    setMapping({});
    setResolutions({});
    setError("");
    setBusy(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function runImport() {
    if (!file || !preview) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<CallImportResult>("/calls/import", {
        method: "POST",
        body: JSON.stringify({
          csv: file.text,
          mapping,
          resolutions,
          filename: file.name,
        }),
      });
      reset();
      setDone(
        `Imported ${result.imported} call${result.imported === 1 ? "" : "s"} from ${file.name}` +
          (result.replacedDays ? ` · ${result.replacedDays} day(s) replaced` : "") +
          (result.skippedRows ? ` · ${result.skippedRows} row(s) left out` : "")
      );
      onImported();
    } catch (err) {
      const message = (err as Error).message;
      setBusy(false);
      // 409: the conflicts changed after the preview (another import ran in
      // between). Re-check so the new ones show up for a decision.
      if ((err as ApiError).status === 409) await check(file.text, mapping, false);
      setError(message);
    }
  }

  const unassigned = preview ? preview.callers.filter((c) => mapping[c.key] === undefined) : [];
  const unresolved = preview ? preview.conflicts.filter((c) => !resolutions[c.key]) : [];
  const importing = preview
    ? preview.callers.reduce((n, c) => (typeof mapping[c.key] === "number" ? n + c.rows : n), 0)
    : 0;
  const ready = Boolean(preview) && !busy && !unassigned.length && !unresolved.length && importing > 0;

  return (
    <div className="rx-admin-upload">
      <div className="rx-admin-upload-row">
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          onChange={chooseFile}
          aria-label="Call log CSV file"
        />
        {file && (
          <button type="button" className="rx-admin-linkbtn" onClick={reset}>
            Clear
          </button>
        )}
      </div>
      <p className="rx-admin-note" style={{ marginTop: 10 }}>
        Upload the phone system&apos;s call-history export as CSV. Kept: NO., Call ID, From Name
        (the user who made the call), From Phone Number, To Phone Number, Start Time
        (MM/DD/YYYY h:mm:ss AM), Duration and Recorded — every other column is ignored.
      </p>

      {error && <p className="rx-admin-error">{error}</p>}
      {done && <p className="rx-admin-ok">{done}</p>}
      {busy && !preview && <p className="rx-admin-note">Checking file…</p>}

      {preview && (
        <>
          <p className="rx-admin-upload-summary">
            <strong>{preview.readableRows}</strong> of {preview.totalRows} rows readable ·{" "}
            {fmtDay(preview.range.from)} – {fmtDay(preview.range.to)}
          </p>
          {preview.missingColumns.length > 0 && (
            <p className="rx-admin-error">
              Not in this file, so left blank: {preview.missingColumns.join(", ")}
            </p>
          )}

          {preview.errorCount > 0 && (
            <details className="rx-admin-details">
              <summary>
                {preview.errorCount} row{preview.errorCount === 1 ? "" : "s"} can&apos;t be read
                and will be left out
              </summary>
              <ul>
                {preview.errors.map((e) => (
                  <li key={e.line}>
                    line {e.line}: {e.message}
                  </li>
                ))}
                {preview.errorCount > preview.errors.length && (
                  <li>…and {preview.errorCount - preview.errors.length} more</li>
                )}
              </ul>
            </details>
          )}

          <h3 className="rx-admin-subhead">Who made the calls</h3>
          <div style={{ overflowX: "auto" }}>
            <table className="rx-admin-table">
              <thead>
                <tr>
                  <th>From Name</th>
                  <th>From Phone Number</th>
                  <th>Calls</th>
                  <th>Dashboard user</th>
                </tr>
              </thead>
              <tbody>
                {preview.callers.map((caller) => {
                  const value = mapping[caller.key];
                  const suggested =
                    caller.suggestedUserId !== null && value === caller.suggestedUserId;
                  return (
                    <tr key={caller.key}>
                      <td>{caller.name}</td>
                      <td className="rx-mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                        {caller.phone || "—"}
                      </td>
                      <td>{caller.rows}</td>
                      <td>
                        <select
                          value={value === undefined ? "" : value === null ? "skip" : String(value)}
                          onChange={(e) => assignCaller(caller.key, e.target.value)}
                          aria-label={`User for ${caller.name} ${caller.phone ?? ""}`}
                        >
                          <option value="" disabled>
                            Choose a user…
                          </option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.username}
                              {u.name ? ` (${u.name})` : ""}
                              {u.status === "disabled" ? " — disabled" : ""}
                            </option>
                          ))}
                          <option value="skip">Don&apos;t import</option>
                        </select>
                        {suggested && (
                          <span className="rx-admin-tag muted">
                            {caller.remembered ? "saved" : "matched"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {preview.conflicts.length > 0 && (
            <>
              <h3 className="rx-admin-subhead">Date conflicts</h3>
              <p className="rx-admin-note" style={{ marginTop: 0 }}>
                These users already have calls logged on these days. <strong>Replace</strong>{" "}
                deletes that day&apos;s existing calls and imports the file&apos;s;{" "}
                <strong>skip</strong> keeps the existing calls and leaves the file&apos;s rows for
                that day out.
              </p>
              <div className="rx-admin-upload-row" style={{ marginTop: 10 }}>
                <button type="button" className="rx-admin-linkbtn" onClick={() => resolveAll("skip")}>
                  Skip all
                </button>
                <button
                  type="button"
                  className="rx-admin-linkbtn"
                  onClick={() => resolveAll("replace")}
                >
                  Replace all
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="rx-admin-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>User</th>
                      <th>Already logged</th>
                      <th>In file</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.conflicts.map((conflict) => (
                      <tr key={conflict.key}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDay(conflict.date)}</td>
                        <td className="rx-mono">{conflict.username}</td>
                        <td>{conflict.existing}</td>
                        <td>{conflict.incoming}</td>
                        <td>
                          <select
                            value={resolutions[conflict.key] ?? ""}
                            onChange={(e) =>
                              setResolutions((r) => ({
                                ...r,
                                [conflict.key]: e.target.value as Resolution,
                              }))
                            }
                            aria-label={`Action for ${conflict.username} on ${conflict.date}`}
                          >
                            <option value="" disabled>
                              Choose…
                            </option>
                            <option value="skip">Skip</option>
                            <option value="replace">Replace</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="rx-admin-upload-row" style={{ marginTop: 20 }}>
            <button className="rx-btn rx-btn-primary" onClick={runImport} disabled={!ready}>
              {busy ? "Checking…" : `Import ${importing} call${importing === 1 ? "" : "s"}`}
            </button>
            <span className="rx-admin-note" style={{ marginTop: 0 }}>
              {unassigned.length > 0
                ? `${unassigned.length} name + number pair(s) still need a user`
                : unresolved.length > 0
                  ? `${unresolved.length} conflicting day(s) need a decision`
                  : ""}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function RecentUploads({ refreshKey }: { refreshKey: number }) {
  const [uploads, setUploads] = useState<CallUpload[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ uploads: CallUpload[] }>("/calls/uploads")
      .then((data) => {
        if (!cancelled) setUploads(data.uploads);
      })
      .catch(() => {
        if (!cancelled) setUploads([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!uploads?.length) return null;

  return (
    <details className="rx-admin-details" style={{ marginTop: 16 }}>
      <summary>Recent uploads</summary>
      <div style={{ overflowX: "auto" }}>
        <table className="rx-admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>File</th>
              <th>By</th>
              <th>Dates</th>
              <th>Imported</th>
              <th>Left out</th>
              <th>Days replaced</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((u) => (
              <tr key={u.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(u.created_at)}</td>
                <td>{u.filename || "—"}</td>
                <td className="rx-mono">{u.uploaded_by_name}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {fmtDay(u.date_from)} – {fmtDay(u.date_to)}
                </td>
                <td>{u.imported_rows}</td>
                <td>{u.skipped_rows}</td>
                <td>{u.replaced_days}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

interface CallFilters {
  user: string;
  from: string;
  to: string;
}

interface CallLogProps extends PanelProps {
  users: AdminUser[];
  refreshKey: number;
}

function CallLog({ me, users, refreshKey, onSignedOut }: CallLogProps) {
  const [state, setState] = useState<CallsResponse | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<CallFilters>({ user: "", from: "", to: "" });
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      return api<CallsResponse>(`/calls?${params}`);
    },
    [filters]
  );

  useEffect(() => {
    let cancelled = false;
    query(0)
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.status === 401) onSignedOut();
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [query, onSignedOut, refreshKey]);

  async function loadMore() {
    if (!state) return;
    setLoadingMore(true);
    try {
      const data = await query(state.entries.length);
      setState((s) => ({ ...data, entries: [...(s?.entries ?? []), ...data.entries] }));
    } catch (err) {
      setError((err as Error).message);
    }
    setLoadingMore(false);
  }

  const set =
    (key: keyof CallFilters) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <div className="rx-admin-filters">
        {me.isMaster && (
          <select value={filters.user} onChange={set("user")} aria-label="Filter by user">
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        )}
        <input type="date" value={filters.from} onChange={set("from")} aria-label="From date" />
        <input type="date" value={filters.to} onChange={set("to")} aria-label="To date" />
      </div>

      {error && <p className="rx-admin-error">{error}</p>}
      {!state && !error && <p style={{ marginTop: 24 }}>Loading…</p>}

      {state?.entries.length === 0 && (
        <p style={{ marginTop: 24 }}>No calls logged for that filter.</p>
      )}

      {state && state.entries.length > 0 && (
        <>
          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table className="rx-admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  {me.isMaster && <th>User</th>}
                  <th>From</th>
                  <th>To</th>
                  <th>Duration</th>
                  <th>Recorded</th>
                  <th>Call ID</th>
                  <th>No.</th>
                </tr>
              </thead>
              <tbody>
                {state.entries.map((call) => (
                  <tr key={call.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDay(call.call_date)}</td>
                    <td className="rx-mono" style={{ fontSize: 13 }}>
                      {call.call_time ? call.call_time.slice(0, 5) : "—"}
                    </td>
                    {me.isMaster && (
                      <td style={{ whiteSpace: "nowrap" }}>
                        <span className="rx-mono">{call.username ?? "deleted user"}</span>
                        {call.caller_name.toLowerCase() !== (call.username ?? "").toLowerCase() && (
                          <>
                            <br />
                            <span style={{ fontSize: 12, color: "var(--color-gray-mid)" }}>
                              as {call.caller_name}
                            </span>
                          </>
                        )}
                      </td>
                    )}
                    <td className="rx-mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                      {call.from_phone || "—"}
                    </td>
                    <td className="rx-mono" style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                      {call.to_phone || "—"}
                    </td>
                    <td className="rx-mono" style={{ fontSize: 13 }}>
                      {fmtDuration(call.duration_seconds)}
                    </td>
                    <td>{call.recorded === null ? "—" : call.recorded ? "Yes" : "No"}</td>
                    <td className="rx-mono" style={{ fontSize: 12, color: "var(--color-gray-mid)" }}>
                      {call.call_id || "—"}
                    </td>
                    <td className="rx-mono" style={{ fontSize: 12, color: "var(--color-gray-mid)" }}>
                      {call.export_no || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.hasMore && (
            <button
              className="rx-btn rx-btn-outline"
              style={{ marginTop: 24 }}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load older"}
            </button>
          )}
        </>
      )}
    </>
  );
}

function CallsPanel({ me, onSignedOut }: PanelProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  // Bumped after an import so the log and upload history reload.
  const [refreshKey, setRefreshKey] = useState(0);

  // Only the master assigns callers and filters by user, and /users is
  // master-only, so nobody else asks for the list.
  useEffect(() => {
    if (!me.isMaster) return;
    let cancelled = false;
    api<UsersResponse>("/users")
      .then((data) => {
        if (!cancelled) setUsers(data.users);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [me.isMaster]);

  return (
    <>
      <PanelHeading
        title="Call logs"
        note={
          me.isMaster
            ? "Calls imported from the phone system's CSV export. Each From Name + From Phone Number pair is tied to a dashboard user."
            : "Calls logged under your account."
        }
      />

      {me.isMaster && (
        <>
          <CallUploadForm users={users} onImported={() => setRefreshKey((k) => k + 1)} />
          <RecentUploads refreshKey={refreshKey} />
        </>
      )}

      <CallLog me={me} users={users} refreshKey={refreshKey} onSignedOut={onSignedOut} />
    </>
  );
}

// --- audit log (master only) ---------------------------------------------

const PAGE_SIZE = 100;

interface AuditFilters {
  username: string;
  action: string;
  resource: string;
}

function AuditPanel({ onSignedOut }: Pick<PanelProps, "onSignedOut">) {
  const [state, setState] = useState<AuditResponse | null>(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<AuditFilters>({ username: "", action: "", resource: "" });
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      return api<AuditResponse>(`/audit?${params}`);
    },
    [filters]
  );

  useEffect(() => {
    let cancelled = false;
    query(0)
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        if (err.status === 401) onSignedOut();
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [query, onSignedOut]);

  async function loadMore() {
    if (!state) return;
    setLoadingMore(true);
    try {
      const data = await query(state.entries.length);
      setState((s) => ({ ...data, entries: [...(s?.entries ?? []), ...data.entries] }));
    } catch (err) {
      setError((err as Error).message);
    }
    setLoadingMore(false);
  }

  const set = (key: keyof AuditFilters) => (e: ChangeEvent<HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  return (
    <>
      <PanelHeading
        title="Audit log"
        note="Every read, write and sign-in, newest first. Only the master admin sees this."
      />

      <div className="rx-admin-filters">
        <select value={filters.username} onChange={set("username")}>
          <option value="">All users</option>
          {(state?.usernames || []).map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select value={filters.action} onChange={set("action")}>
          <option value="">All actions</option>
          {(state?.actions || []).map((a) => (
            <option key={a} value={a}>
              {a.replace("_", " ")}
            </option>
          ))}
        </select>
        <select value={filters.resource} onChange={set("resource")}>
          <option value="">All areas</option>
          {["clients", "revision", "calls", "users", "audit", "session"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rx-admin-error">{error}</p>}
      {!state && !error && <p style={{ marginTop: 24 }}>Loading…</p>}

      {state?.entries.length === 0 && (
        <p style={{ marginTop: 24 }}>Nothing recorded yet for that filter.</p>
      )}

      {state && state.entries.length > 0 && (
        <>
          <div style={{ overflowX: "auto", marginTop: 20 }}>
            <table className="rx-admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Area</th>
                  <th>Record</th>
                  <th>Detail</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {state.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                      {fmtDateTime(entry.created_at)}
                    </td>
                    <td className="rx-mono" style={{ whiteSpace: "nowrap" }}>{entry.username}</td>
                    <td>
                      <span className={`rx-admin-action ${entry.action}`}>
                        {entry.action.replace("_", " ")}
                      </span>
                    </td>
                    <td>{entry.resource}</td>
                    <td className="rx-mono" style={{ fontSize: 13 }}>{entry.resource_id || "—"}</td>
                    <td style={{ fontSize: 13, color: "var(--color-gray-mid)" }}>
                      {entry.detail || "—"}
                    </td>
                    <td className="rx-mono" style={{ fontSize: 12 }}>{entry.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {state.hasMore && (
            <button
              className="rx-btn rx-btn-outline"
              style={{ marginTop: 24 }}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading…" : "Load older"}
            </button>
          )}
        </>
      )}
    </>
  );
}

// The left-hand menu. One entry per section — adding a section means adding a
// line here and its panel component; the menu item, the route (/admin/<id>) and
// the default landing section all follow from this list.
//
// `when` decides who sees the item. It only hides the menu entry and its route:
// the server checks permissions again on every request, so a hidden section is
// not a protected one.
interface Section {
  id: string;
  label: string;
  icon: LucideIcon;
  Panel: ComponentType<PanelProps>;
  when: (user: AdminUser) => boolean;
}

const SECTIONS: Section[] = [
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    Panel: ClientsPanel,
    when: (user) => can(user, "clients:read"),
  },
  {
    id: "calls",
    label: "Call logs",
    icon: PhoneCall,
    Panel: CallsPanel,
    when: (user) => can(user, "calls:read"),
  },
  {
    id: "users",
    label: "Users",
    icon: UserCog,
    Panel: UsersPanel,
    when: (user) => user.isMaster,
  },
  {
    id: "audit",
    label: "Audit log",
    icon: ScrollText,
    Panel: AuditPanel,
    when: (user) => user.isMaster,
  },
];

interface MenuProps {
  sections: Section[];
  me: AdminUser;
  onSignOut: () => void;
}

function Menu({ sections, me, onSignOut }: MenuProps) {
  return (
    <aside className="rx-admin-sidebar">
      <div className="rx-eyebrow">admin</div>

      <nav className="rx-admin-menu" aria-label="Admin sections">
        {sections.map(({ id, label, icon: Icon }) => (
          <NavLink
            key={id}
            to={`/admin/${id}`}
            className={({ isActive }) =>
              `rx-admin-menu-item${isActive ? " active" : ""}`
            }
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="rx-admin-whoami">
        <span className="rx-mono">{me.username}</span>
        <span>{me.isMaster ? "master admin" : me.role}</span>
      </div>

      <button className="rx-admin-signout" onClick={onSignOut}>
        <LogOut size={16} aria-hidden="true" />
        Sign out
      </button>
    </aside>
  );
}

function UnknownSection() {
  return (
    <>
      <PanelHeading title="Not found" note="That section doesn't exist yet." />
      <p style={{ marginTop: 24 }}>
        Pick one from the menu — or add it to SECTIONS in{" "}
        <code className="rx-mono">src/pages/Admin.tsx</code>.
      </p>
    </>
  );
}

function Dashboard({ me, onSignedOut }: PanelProps) {
  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    onSignedOut();
  }

  // Only the sections this account may use. A telemarketer who types
  // /admin/users lands on "not found" rather than an empty panel — and the API
  // would refuse them anyway.
  const sections = SECTIONS.filter((section) => section.when(me));

  return (
    <div className="rx-admin-shell">
      <Menu sections={sections} me={me} onSignOut={signOut} />

      <div className="rx-admin-panel">
        <Routes>
          {sections.length > 0 && (
            <Route index element={<Navigate to={sections[0].id} replace />} />
          )}
          {sections.map(({ id, Panel }) => (
            <Route key={id} path={id} element={<Panel me={me} onSignedOut={onSignedOut} />} />
          ))}
          <Route path="*" element={<UnknownSection />} />
        </Routes>
      </div>
    </div>
  );
}

function Admin() {
  // `me` doubles as the signed-in flag: null once checked and signed out,
  // undefined while the session request is still in flight.
  const [me, setMe] = useState<AdminUser | null | undefined>(undefined);
  const [seeded, setSeeded] = useState(false);

  // Stable identity so the panels' fetch effects don't re-run on every render.
  const handleSignedOut = useCallback(() => setMe(null), []);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d: SessionResponse) => {
        setMe(d.signedIn ? d.user : null);
        setSeeded(Boolean(d.seeded));
      })
      .catch(() => setMe(null));
  }, []);

  return (
    <section className="rx-section">
      <Seo
        path="/admin"
        title="Admin"
        description="Restricted area."
        noindex
      />
      <div className="rx-wrap">
        {me === undefined ? null : me ? (
          <Dashboard me={me} onSignedOut={handleSignedOut} />
        ) : (
          <Login onSignedIn={(user) => setMe(user)} seeded={seeded} />
        )}
      </div>
    </section>
  );
}

export default Admin;
