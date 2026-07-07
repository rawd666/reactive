import { useState } from "react";
import { ArrowRight } from "lucide-react";

function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    business: "",
    package: "",
    message: "",
  });

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rx-form">
        <h3 className="rx-h3" style={{ marginBottom: 12 }}>
          Message ready to send
        </h3>
        <p style={{ color: "var(--color-text-body)" }}>
          Thanks, {form.name || "there"}. In a live version of this site, this form would send your
          message straight through. For now, reach out directly at{" "}
          <a href="mailto:hello@reactivestudio.com" style={{ color: "var(--color-pink)" }}>
            hello@reactivestudio.com
          </a>
          .
        </p>
        <button
          className="rx-btn rx-btn-outline"
          style={{ marginTop: 20, alignSelf: "flex-start" }}
          onClick={() => setSubmitted(false)}
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
      />

      <label className="rx-mono" htmlFor="rx-package">
        interested in
      </label>
      <select id="rx-package" value={form.package} onChange={update("package")}>
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
      />

      <button type="submit" className="rx-btn rx-btn-primary rx-btn-full" style={{ marginTop: 8 }}>
        Send message <ArrowRight size={16} />
      </button>
    </form>
  );
}

export default ContactForm;