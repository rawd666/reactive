import { Check } from "lucide-react";
import Seo from "../components/common/Seo";
import { PLANS } from "../data/plans";
import { TERMS, TERMS_LAST_UPDATED } from "../data/terms";

function Terms() {
  return (
    <section className="rx-section">
      <Seo
        path="/terms"
        title="Terms & Conditions"
        description="The terms that govern website projects purchased through Reactive, including scope, fees, ownership, and support."
      />
      <div className="rx-wrap">
        <div className="rx-eyebrow">legal</div>
        <h1 className="rx-h1" style={{ fontSize: "clamp(34px,5vw,56px)" }}>
          Terms &amp; Conditions
        </h1>
        <p className="rx-lead" style={{ marginTop: 20 }}>
          Last updated: {TERMS_LAST_UPDATED}. This Agreement governs any project purchased through
          this site between Reactive ("Developer") and the purchasing individual or business
          ("Client"). Section 16 explains how Client accepts these terms.
        </p>

        <div style={{ maxWidth: 760, marginTop: 48 }}>
          {TERMS.map((s) => (
            <div key={s.n}>
              <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: s.n === 1 ? 0 : 36 }}>
                {s.n}. {s.title}
              </h2>
              {s.body.map((para, i) => (
                <p key={i} style={{ marginBottom: 12 }}>
                  {para}
                </p>
              ))}
              {s.showPackages && (
                <div className="rx-notes-grid" style={{ marginTop: 20, marginBottom: 12 }}>
                  {PLANS.map((plan) => (
                    <div key={plan.id}>
                      <h3 className="rx-h3">{plan.name}</h3>
                      <ul className="rx-price-features">
                        {plan.features.map((f, i) => (
                          <li key={i}>
                            <Check size={14} />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          <p style={{ marginTop: 36, fontSize: 13, color: "var(--color-gray-mid)" }}>
            Questions about these terms? Reach out via the <a href="/contact">contact page</a>{" "}
            before purchasing.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Terms;
