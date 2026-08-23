export const PRIVACY_VERSION = "2026-08-23";

function Privacy() {
  return (
    <section className="rx-section" style={{ borderBottom: "none" }}>
      <div className="rx-wrap">
        <div className="rx-eyebrow">legal</div>
        <h1 className="rx-h1" style={{ fontSize: "clamp(34px,5vw,56px)" }}>
          Privacy Policy
        </h1>
        <p className="rx-lead" style={{ marginTop: 20 }}>
          Last updated: August 23, 2026. This policy explains what personal information Reactive
          ("we", "us") collects through this site, why we collect it, and how it's handled.
        </p>

        <div style={{ maxWidth: 760, marginTop: 48 }}>
          <h2 className="rx-h3" style={{ marginBottom: 8 }}>1. Information we collect</h2>
          <p style={{ marginBottom: 12 }}>
            We only collect information you actively provide through the two forms on this site:
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Checkout (payment via PayPal).</strong> Payment itself is handled entirely by
            PayPal — we never see, collect, or store your card number or PayPal login credentials.
            When your payment is approved, PayPal shares with us your name, your email address, and
            the subscription ID for the package you purchased, so we can confirm the payment and get
            in touch about your project.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Contact form.</strong> When you submit the contact form, we receive whatever you
            type into it: your name, your email address, your business name (if provided), the
            package you're interested in (if selected), and your message.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>2. How we use your information</h2>
          <p style={{ marginBottom: 12 }}>
            We use the information above only to: confirm and fulfill a purchase, communicate with
            you about your project or inquiry, and respond to messages sent through the contact
            form. We do not use your information for advertising, and we do not sell or rent it to
            anyone.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>3. Third parties we rely on</h2>
          <p style={{ marginBottom: 12 }}>
            We use a small number of third-party services to run this site, and each processes
            information under its own privacy policy:
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>PayPal</strong> processes all payments and subscription billing. PayPal's
            checkout buttons may set their own cookies or tracking as part of that service — that
            activity is governed by PayPal's privacy policy, not this one.
          </p>
          <p style={{ marginBottom: 12 }}>
            <strong>Google (Gmail).</strong> Contact form messages and checkout confirmations are
            delivered to us by email through Gmail. Submitting either form means that information
            passes through Google's systems in transit.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>4. Data storage &amp; retention</h2>
          <p style={{ marginBottom: 12 }}>
            This site does not use a database to store the information you submit. Contact form
            submissions and checkout confirmations are sent directly to our email inbox and retained
            there for as long as needed to manage the client relationship, respond to your inquiry,
            or meet our legal and accounting obligations, after which they may be deleted. The only
            thing retained on the server itself is a short-lived, in-memory list of subscription IDs
            used to avoid sending a duplicate confirmation email — no personal details are stored in
            it, and it clears automatically when the server restarts.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>5. Cookies &amp; tracking</h2>
          <p style={{ marginBottom: 12 }}>
            This site does not itself set analytics, advertising, or tracking cookies. The only
            cookies you may encounter are set by PayPal's checkout SDK when it loads on the checkout
            page, as described in Section 3.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>6. Security</h2>
          <p style={{ marginBottom: 12 }}>
            Information submitted through this site is transmitted over an encrypted (HTTPS)
            connection. Because we don't store submissions in a database, there's no ongoing
            database of client information on our servers for a breach to expose — the data lives in
            our email inbox, protected by our email provider's own account security.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>7. Your choices</h2>
          <p style={{ marginBottom: 12 }}>
            You can ask us to delete the information we hold about you, correct it, or tell you what
            we have on file, by reaching out through the contact page. We'll respond within a
            reasonable time, though information tied to an active subscription or a completed
            purchase may need to be kept as required for billing, tax, or legal recordkeeping.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>8. Children's privacy</h2>
          <p style={{ marginBottom: 12 }}>
            This site is intended for business use and is not directed at children. We do not
            knowingly collect information from anyone under 16.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>9. Changes to this policy</h2>
          <p style={{ marginBottom: 12 }}>
            We may update this policy from time to time. The "Last updated" date above will reflect
            the most recent revision. Material changes will be reflected here before they take
            effect.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>10. Contact</h2>
          <p style={{ marginBottom: 12 }}>
            Questions about this policy, or requests regarding your information, can be sent through
            the <a href="/contact">contact page</a>.
          </p>

          <p style={{ marginTop: 36, fontSize: 13, color: "var(--color-gray-mid)" }}>
            See also our <a href="/terms">Terms &amp; Conditions</a>, which govern any project
            purchased through this site.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Privacy;
