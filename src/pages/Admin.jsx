import { useCallback, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Users, LogOut } from "lucide-react";
import Seo from "../components/common/Seo";

// Owner-only dashboard. Nothing here is secret on its own — the protection is
// server-side: every /api/admin/* data route returns 401 without a valid session
// cookie. This page just renders what the API is willing to hand over.
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
      onSignedIn();
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

// The left-hand menu. One entry per section — adding a section means adding a
// line here and its panel component; the menu item, the route (/admin/<id>) and
// the default landing section all follow from this list.
const SECTIONS = [
  { id: "clients", label: "Clients", icon: Users, Panel: ClientsPanel },
];

function Menu({ onSignOut }) {
  return (
    <aside className="rx-admin-sidebar">
      <div className="rx-eyebrow">admin</div>

      <nav className="rx-admin-menu" aria-label="Admin sections">
        {SECTIONS.map(({ id, label, icon: Icon }) => (
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

function Dashboard({ onSignedOut }) {
  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    onSignedOut();
  }

  return (
    <div className="rx-admin-shell">
      <Menu onSignOut={signOut} />

      <div className="rx-admin-panel">
        <Routes>
          <Route index element={<Navigate to={SECTIONS[0].id} replace />} />
          {SECTIONS.map(({ id, Panel }) => (
            <Route key={id} path={id} element={<Panel onSignedOut={onSignedOut} />} />
          ))}
          <Route path="*" element={<UnknownSection />} />
        </Routes>
      </div>
    </div>
  );
}

function Admin() {
  const [signedIn, setSignedIn] = useState(null);
  const [seeded, setSeeded] = useState(false);

  // Stable identity so the panels' fetch effects don't re-run on every render.
  const handleSignedOut = useCallback(() => setSignedIn(false), []);

  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => {
        setSignedIn(Boolean(d.signedIn));
        setSeeded(Boolean(d.seeded));
      })
      .catch(() => setSignedIn(false));
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
        {signedIn === null ? null : signedIn ? (
          <Dashboard onSignedOut={handleSignedOut} />
        ) : (
          <Login onSignedIn={() => setSignedIn(true)} seeded={seeded} />
        )}
      </div>
    </section>
  );
}

export default Admin;
