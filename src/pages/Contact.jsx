import ContactForm from "../components/common/ContactForm";
import { Mail, Clock, Globe } from "lucide-react";

function Contact() {
  return (
    <section className="rx-section" style={{ borderBottom: "none" }}>
      <div className="rx-wrap rx-split-grid">
        <div>
          <div className="rx-eyebrow">get in touch</div>
          <h1 className="rx-h1" style={{ fontSize: "clamp(34px,5vw,56px)" }}>
            Tell me about
            <br />
            your business.
          </h1>
          <p className="rx-lead" style={{ marginTop: 20 }}>
            Send a few details about what you're building and what you need. I read every message
            myself and reply within 1-2 business days.
          </p>

          <div className="rx-contact-info">
            <div className="rx-contact-info-row">
              <Mail size={18} />
              <div>
                <div className="rx-contact-label rx-mono">email</div>
                <a href="mailto:rawd.nimer@gmail.com">rawd.nimer@gmail.com</a>
              </div>
            </div>
            <div className="rx-contact-info-row">
              <Clock size={18} />
              <div>
                <div className="rx-contact-label rx-mono">response time</div>
                <p style={{ color: "var(--color-white)" }}>1-2 business days</p>
              </div>
            </div>
            <div className="rx-contact-info-row">
              <Globe size={18} />
              <div>
                <div className="rx-contact-label rx-mono">based in</div>
                <p style={{ color: "var(--color-white)" }}>Working with clients remotely, anywhere</p>
              </div>
            </div>
          </div>
        </div>

        <ContactForm />
      </div>
    </section>
  );
}

export default Contact;