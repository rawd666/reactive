import PriceCard from "../components/common/PriceCard";
import { PLANS } from "../data/plans";
import { NOTES } from "../data/notes";

function Packages() {
  return (
    <>
      <section className="rx-section" style={{ paddingBottom: 60 }}>
        <div className="rx-wrap">
          <div className="rx-eyebrow">packages</div>
          <h1 className="rx-h1" style={{ fontSize: "clamp(34px,5vw,56px)" }}>
            Pick a starting point.
            <br />
            Every site is still built around you.
          </h1>
          <p className="rx-lead" style={{ marginTop: 20 }}>
            These packages cover the most common project sizes. The one-time fee covers design and
            development; the monthly fee covers hosting, security, and keeping the site running.
            Nothing here is rigid — if your project sits between two packages, we'll shape it around
            what you actually need.
          </p>
        </div>
      </section>

      <section className="rx-section">
        <div className="rx-wrap rx-pricing-grid">
          {PLANS.map((plan) => (
            <PriceCard key={plan.name} plan={plan} />
          ))}
        </div>
      </section>

      <section className="rx-section" style={{ borderBottom: "none" }}>
        <div className="rx-wrap">
          <div className="rx-eyebrow">good to know</div>
          <h2 className="rx-h2" style={{ maxWidth: 640 }}>
            Frequently asked.
          </h2>
          <div className="rx-notes-grid">
            {NOTES.map((n, i) => (
              <div key={i}>
                <h3 className="rx-h3">{n.title}</h3>
                <p>{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default Packages;