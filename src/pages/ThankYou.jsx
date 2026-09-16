import { Link, useLocation } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import Seo from "../components/common/Seo";

function ThankYou() {
  const location = useLocation();
  const planName = location.state?.planName;

  return (
    <section className="rx-section">
      <Seo path="/checkout/thank-you" title="Thank You" description="Your Reactive package purchase is confirmed." noindex />
      <div className="rx-wrap rx-thank-you">
        <CheckCircle size={48} color="var(--color-pink)" />
        <h1 className="rx-h1" style={{ fontSize: "clamp(34px,5vw,56px)", marginTop: 24 }}>
          You're all set.
        </h1>
        <p className="rx-lead" style={{ margin: "16px auto 0" }}>
          {planName ? (
            <>
              Thanks for subscribing to the <strong>{planName}</strong> plan.
            </>
          ) : (
            <>Thanks, your payment went through.</>
          )}{" "}
          I've got the details and I'll reach out within 1-2 business days to kick things off.
        </p>
        <div
          style={{ display: "flex", gap: 16, marginTop: 36, justifyContent: "center", flexWrap: "wrap" }}
        >
          <Link to="/" className="rx-btn rx-btn-primary">
            Back to home
          </Link>
          <Link to="/contact" className="rx-btn rx-btn-outline">
            Have a question?
          </Link>
        </div>
      </div>
    </section>
  );
}

export default ThankYou;
