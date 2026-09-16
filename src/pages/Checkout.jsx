import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Check } from "lucide-react";
import Seo from "../components/common/Seo";
import { PLANS } from "../data/plans";
import { TERMS_VERSION } from "./Terms";
import { PRIVACY_VERSION } from "./Privacy";

function Checkout() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const plan = PLANS.find((p) => p.id === planId);
  const [status, setStatus] = useState({ loading: false, error: "" });
  const [agreed, setAgreed] = useState(false);

  if (!plan) {
    return (
      <section className="rx-section">
        <Seo path="/checkout" title="Checkout" description="Complete your Reactive package purchase." noindex />
        <div className="rx-wrap" style={{ textAlign: "center" }}>
          <h1 className="rx-h1" style={{ fontSize: "clamp(28px,4vw,44px)" }}>
            Plan not found
          </h1>
          <p className="rx-lead" style={{ margin: "16px auto 32px" }}>
            That package doesn't exist. Take a look at the current lineup.
          </p>
          <Link to="/packages" className="rx-btn rx-btn-primary">
            View packages
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rx-section">
      <Seo path="/checkout" title="Checkout" description="Complete your Reactive package purchase." noindex />
      <div className="rx-wrap rx-split-grid">
        <div>
          <div className="rx-eyebrow">checkout</div>
          <h1 className="rx-h1" style={{ fontSize: "clamp(34px,5vw,56px)" }}>
            Start with {plan.name}.
          </h1>
          <p className="rx-lead" style={{ marginTop: 20 }}>
            {plan.sub}
          </p>

          <div className="rx-order-summary">
            <div className="rx-order-row">
              <span>Setup fee</span>
              <span className="rx-mono">{plan.price}</span>
            </div>
            <div className="rx-order-row">
              <span>Hosting &amp; upkeep</span>
              <span className="rx-mono">{plan.monthly}/mo</span>
            </div>
            <ul className="rx-price-features" style={{ marginTop: 20 }}>
              {plan.features.map((f, i) => (
                <li key={i}>
                  <Check size={14} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rx-checkout-panel">
          <h3 className="rx-h3" style={{ marginBottom: 8 }}>
            Pay with PayPal
          </h3>
          <p style={{ color: "var(--color-text-body)", fontSize: 14, marginBottom: 24 }}>
            You'll be subscribed to the {plan.name} plan. The setup fee and first month's hosting
            are billed together; billing repeats monthly after that.
          </p>

          {status.error && (
            <p style={{ color: "red", fontSize: 14, marginBottom: 16 }}>{status.error}</p>
          )}

          <label className="rx-terms-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={status.loading}
            />
            <span>
              I have read and agree to the{" "}
              <Link to="/terms" target="_blank" rel="noopener noreferrer">
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
              , including the {plan.name} package's included features and revision limits.
            </span>
          </label>

          <PayPalScriptProvider
            options={{
              "client-id": import.meta.env.VITE_PAYPAL_CLIENT_ID,
              components: "buttons",
              intent: "subscription",
              vault: true,
            }}
          >
            <PayPalButtons
              style={{ label: "subscribe" }}
              disabled={status.loading || !agreed}
              createSubscription={(data, actions) =>
                actions.subscription.create({ plan_id: plan.planId })
              }
              onApprove={async (data) => {
                setStatus({ loading: true, error: "" });
                try {
                  const response = await fetch("/api/subscription/activate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      subscriptionID: data.subscriptionID,
                      planId: plan.id,
                      agreedToTerms: agreed,
                      termsVersion: TERMS_VERSION,
                      agreedToPrivacy: agreed,
                      privacyVersion: PRIVACY_VERSION,
                    }),
                  });

                  if (!response.ok) throw new Error("Activation failed");

                  navigate("/checkout/thank-you", { state: { planName: plan.name } });
                } catch (err) {
                  setStatus({
                    loading: false,
                    error:
                      "Payment went through, but we couldn't confirm it on our end. Contact me and I'll sort it out.",
                  });
                }
              }}
              onError={() =>
                setStatus({ loading: false, error: "Something went wrong with PayPal. Please try again." })
              }
              onCancel={() => setStatus({ loading: false, error: "" })}
            />
          </PayPalScriptProvider>

          <p className="rx-form-note">
            Payments are processed securely by PayPal. Card payments are supported without a
            PayPal account.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Checkout;
