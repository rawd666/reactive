import { useNavigate } from "react-router-dom";
import CodeWindow from "../components/common/CodeWindow";
import { REASONS } from "../data/reasons";
import { FEATURES } from "../data/features";
import { PROCESS } from "../data/process";

function Home() {
  const navigate = useNavigate();

  return (
    <>
      <section className="rx-section" style={{ paddingTop: 96 }}>
        <div className="rx-wrap rx-hero-grid">
          <div>
            <div className="rx-eyebrow">built by one developer, for businesses just getting started</div>
            <h1 className="rx-h1">
              A website that moves
              <br />
              as fast as your business does.
            </h1>
            <p className="rx-lead" style={{ marginTop: 24 }}>
              I design and build custom websites with React. No drag-and-drop templates, no
              cookie-cutter layouts. If you can describe it, I can build it into your site: booking
              systems, animations, dashboards, e-commerce, the works.
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 36, flexWrap: "wrap" }}>
              <button className="rx-btn rx-btn-primary" onClick={() => navigate("/packages")}>
                See packages
              </button>
              <button className="rx-btn rx-btn-outline" onClick={() => navigate("/contact")}>
                Get in touch
              </button>
            </div>
          </div>
          <CodeWindow />
        </div>
      </section>

      <section className="rx-section">
        <div className="rx-wrap">
          <div className="rx-eyebrow">why it matters</div>
          <h2 className="rx-h2" style={{ maxWidth: 640 }}>
            Your business is real. Your website should prove it.
          </h2>
          <p className="rx-lead" style={{ marginTop: 16 }}>
            Social media accounts and marketplace listings are rented land — the platform sets the
            rules, the algorithm decides who sees you, and the design looks like everyone else's. A
            website is the one piece of your business that's fully yours.
          </p>
          <div className="rx-grid-3" style={{ marginTop: 56 }}>
            {REASONS.map((r) => (
              <div className="rx-reason" key={r.n}>
                <div className="rx-reason-mark rx-mono">{r.n}</div>
                <h3 className="rx-h3">{r.title}</h3>
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rx-section">
        <div className="rx-wrap rx-split-grid">
          <div>
            <div className="rx-eyebrow">how it's built</div>
            <h2 className="rx-h2">
              Built with React.
              <br />
              That means no limits.
            </h2>
          </div>
          <div>
            <p className="rx-lead">
              Most small-business websites are assembled from page builders — fine for a basic
              brochure, but they hit a wall fast. I build every site from scratch in React, which
              means the site is made of real, custom components instead of pre-made blocks.
            </p>
            <ul className="rx-feature-list">
              {FEATURES.map((f, i) => (
                <li key={i}>
                  <span className="rx-bracket-pink rx-mono">&lt;/&gt;</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="rx-section">
        <div className="rx-wrap rx-split-grid even">
          <div>
            <div className="rx-eyebrow">who this is for</div>
            <h2 className="rx-h2">
              Built for businesses
              <br />
              on their way up.
            </h2>
            <p className="rx-lead" style={{ marginTop: 20 }}>
              I work best with new and early-stage businesses — the ones who know exactly where
              they're headed but haven't had a website that looks like it yet. That's the gap I
              close.
            </p>
          </div>
          <div>
            <p style={{ marginBottom: 20 }}>
              Because it's just me, you're never handed off to a project manager or a junior
              designer. You work directly with the person building your site, from the first
              conversation to launch day — which usually means it moves faster and fits your actual
              business, not a generic mold.
            </p>
            <p>
              Whether you're opening your doors for the first time or finally ready to look as
              legitimate online as you are in person, this is built around that moment.
            </p>
          </div>
        </div>
      </section>

      <section className="rx-section">
        <div className="rx-wrap">
          <div className="rx-eyebrow">the process</div>
          <h2 className="rx-h2">Three steps. No surprises.</h2>
          <div className="rx-process-list">
            {PROCESS.map((step) => (
              <div className="rx-process-item" key={step.n}>
                <div className="rx-process-num rx-mono">{step.n}</div>
                <div>
                  <h3 className="rx-h3">{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rx-section" style={{ borderBottom: "none" }}>
        <div className="rx-wrap rx-cta-banner">
          <h2 className="rx-h2">Ready to build something real?</h2>
          <p className="rx-lead" style={{ margin: "16px auto 32px" }}>
            Take a look at how projects are packaged, or just reach out and tell me about your
            business.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="rx-btn rx-btn-primary" onClick={() => navigate("/packages")}>
              View packages
            </button>
            <button className="rx-btn rx-btn-outline" onClick={() => navigate("/contact")}>
              Contact me
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;