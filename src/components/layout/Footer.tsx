import { NavLink } from "react-router-dom";
import { PAGES } from "../../data/pages";

function Footer() {
  return (
    <footer className="rx-footer">
      <div className="rx-wrap rx-footer-inner">
        <p>
          <span className="bracket">&lt;</span>Reactive<span className="bracket">/&gt;</span> — websites
          built with React, one project at a time.
        </p>
        <div className="rx-foot-links">
          {PAGES.map((p) => (
            <NavLink key={p.path} to={p.path} className="rx-navlink">
              {p.label}
            </NavLink>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;