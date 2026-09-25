import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Users, UserCog, ScrollText, LogOut, Trash2, Plus } from "lucide-react";
import Seo from "../components/common/Seo";

// Owner-only dashboard. Nothing here is secret on its own — the protection is
// server-side: every /api/admin/* route checks the signed-in user's permissions
// and returns 401/403 on its own. This page just renders what the API is
// willing to hand over, and hides the menu items it would refuse anyway.
//
// Layout: a left-hand menu (SECTIONS, further down) beside the active panel.
// Each section is its own route under /admin, so a section can be linked to,
// reloaded, and reached with the back button.

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function can(user, permission) {
  if (!user) return false;
  return user.isMaster || user.permissions.includes(permission);
}

// Turns "clients:write" into "clients · write" for the permission checkboxes.
function permissionLabel(permission) {
  return permission.replace(":", " · ");
}

async function api(path, options) {
  const res = await fetch(`/api/admin${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || `Request failed (${res.status})`);
    // The status rides along so callers can tell "session expired" (401) from
    // "you're not allowed" (403) — the server's message alone doesn't say.
    error.status = res.status;
    throw error;
  }
  return data;
}

function Login({ onSignedIn, seeded }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
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
      setError(err.message);
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

function ClientRow({ client, onChange }) {
  const [business, setBusiness] = useState(client.business_name || "");
  const [saving, setSaving] = useState(false);

  async function patch(body) {
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
          onChange={(e) => patch({ status: e.target.value })}
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
function PanelHeading({ title, note }) {
  return (
    <header className="rx-admin-panel-head">
      <h1 className="rx-h2">{title}</h1>
      {note && <p className="rx-admin-panel-note">{note}</p>}
    </header>
  );
}

function ClientsPanel({ onSignedOut }) {
  const [clients, setClients] = useState(null);
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
        const data = await res.json();
        if (!cancelled) setClients(data.clients);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load clients.");
      });

    return () => {
      cancelled = true;
    };
  }, [onSignedOut]);

  function replace(updated) {
    setClients((prev) =>
      prev.map((c) => (c.client_code === updated.client_code ? updated : c))
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

      {clients?.length > 0 && (
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

function NewUserForm({ roles, onCreated }) {
  const blank = { username: "", email: "", name: "", role: "telemarketer", password: "" };
  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { user } = await api("/users", { method: "POST", body: JSON.stringify(form) });
      setForm(blank);
      onCreated(user);
    } catch (err) {
      setError(err.message);
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

function UserRow({ user, permissions, onChange, onDelete, isSelf }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function patch(body) {
    setBusy(true);
    setError("");
    try {
      const data = await api(`/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChange(data.user);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  function togglePermission(permission) {
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
      setError(err.message);
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
          <select value={user.role} onChange={(e) => patch({ role: e.target.value })} disabled={busy}>
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
            onChange={(e) => patch({ status: e.target.value })}
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

function UsersPanel({ me, onSignedOut }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api("/users")
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onSignedOut();
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [onSignedOut]);

  function replace(user) {
    setState((s) => ({ ...s, users: s.users.map((u) => (u.id === user.id ? user : u)) }));
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
                      setState((s) => ({ ...s, users: s.users.filter((u) => u.id !== id) }))
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
            onCreated={(user) => setState((s) => ({ ...s, users: [...s.users, user] }))}
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

// --- audit log (master only) ---------------------------------------------

const PAGE_SIZE = 100;

function AuditPanel({ onSignedOut }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ username: "", action: "", resource: "" });
  const [loadingMore, setLoadingMore] = useState(false);

  const query = useCallback(
    (offset) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
      return api(`/audit?${params}`);
    },
    [filters]
  );

  useEffect(() => {
    let cancelled = false;
    query(0)
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) onSignedOut();
        else setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [query, onSignedOut]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const data = await query(state.entries.length);
      setState((s) => ({ ...data, entries: [...s.entries, ...data.entries] }));
    } catch (err) {
      setError(err.message);
    }
    setLoadingMore(false);
  }

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

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
          {["clients", "revision", "users", "audit", "session"].map((r) => (
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

      {state?.entries.length > 0 && (
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
const SECTIONS = [
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    Panel: ClientsPanel,
    when: (user) => can(user, "clients:read"),
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

function Menu({ sections, me, onSignOut }) {
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
        <code className="rx-mono">src/pages/Admin.jsx</code>.
      </p>
    </>
  );
}

function Dashboard({ me, onSignedOut }) {
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
  const [me, setMe] = useState(undefined);
  const [seeded, setSeeded] = useState(false);

  // Stable identity so the panels' fetch effects don't re-run on every render.
  const handleSignedOut = useCallback(() => setMe(null), []);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => {
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
