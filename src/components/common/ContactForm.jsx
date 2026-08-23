import { useState } from "react";
import { ArrowRight } from "lucide-react";

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [status, setStatus] = useState({ loading: false, error: "" }); // Tracks API state
  const [form, setForm] = useState({
    name: "",
    email: "",
    business: "",
    package: "",
    message: "",
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, error: "" });

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        setSubmitted(true);
        setStatus({ loading: false, error: "" });
      } else {
        const data = await response.json();
        setStatus({ loading: false, error: data.error || "Failed to send email." });
      }
    } catch (err) {
      setStatus({ loading: false, error: "Server connection error. Please try again." });
    }
  };

  if (submitted) {
    return (
      <div className="rx-form">
        <h3 className="rx-h3" style={{ marginBottom: 12 }}>
          Message sent successfully!
        </h3>
        <p style={{ color: "var(--color-text-body)" }}>
          Thanks, {form.name || "there"}. Your message has been sent straight through to my inbox. If you need anything else, you can also reach out directly at{" "}
          <a href="mailto:rawd@reactiveweb.dev" style={{ color: "var(--color-pink)" }}>
            rawd@reactiveweb.dev
          </a>
          .
        </p>
        <button
          className="rx-btn rx-btn-outline"
          style={{ marginTop: 20, alignSelf: "flex-start" }}
          onClick={() => {
            setSubmitted(false);
            setForm({ name: "", email: "", business: "", package: "", message: "" }); // Reset form
          }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className="rx-form" onSubmit={handleSubmit}>
      <label className="rx-mono" htmlFor="rx-name">
        name
      </label>
      <input
        id="rx-name"
        type="text"
        required
        placeholder="Your name"
        value={form.name}
        onChange={update("name")}
        disabled={status.loading}
      />

      <label className="rx-mono" htmlFor="rx-email">
        email
      </label>
      <input
        id="rx-email"
        type="email"
        required
        placeholder="you@business.com"
        value={form.email}
        onChange={update("email")}
        disabled={status.loading}
      />

      <label className="rx-mono" htmlFor="rx-business">
        business name
      </label>
      <input
        id="rx-business"
        type="text"
        placeholder="What's it called?"
        value={form.business}
        onChange={update("business")}
        disabled={status.loading}
      />

      <label className="rx-mono" htmlFor="rx-package">
        interested in
      </label>
      <select 
        id="rx-package" 
        value={form.package} 
        onChange={update("package")}
        disabled={status.loading}
      >
        <option value="">Not sure yet</option>
        <option value="Launch">Launch</option>
        <option value="Grow">Grow</option>
        <option value="Scale">Scale</option>
      </select>

      <label className="rx-mono" htmlFor="rx-message">
        message
      </label>
      <textarea
        id="rx-message"
        rows={5}
        required
        placeholder="Tell me a bit about your business and what you're looking for."
        value={form.message}
        onChange={update("message")}
        disabled={status.loading}
      />

      {status.error && (
        <p style={{ color: "red", fontSize: "14px", marginTop: "8px", marginBottom: "4px" }}>
          {status.error}
        </p>
      )}

      <button 
        type="submit" 
        className="rx-btn rx-btn-primary rx-btn-full" 
        style={{ marginTop: 8 }}
        disabled={status.loading}
      >
        {status.loading ? "Sending..." : "Send message"} <ArrowRight size={16} />
      </button>
    </form>
  );
}

export default ContactForm;
