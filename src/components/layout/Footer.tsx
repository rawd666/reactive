import { NavLink } from "react-router-dom";

function Footer() {
  return (
    <footer className="rx-footer">
      <div className="rx-wrap rx-footer-inner">
        <p>
          <span className="bracket">&lt;</span>Reactive<span className="bracket">/&gt;</span> — websites
          built with React, one project at a time.
        </p>
        <div className="rx-foot-links">
          <NavLink to="/terms" className="rx-navlink">
            Terms
          </NavLink>
          <NavLink to="/privacy" className="rx-navlink">
            Privacy
          </NavLink>
        </div>
      </div>
    </footer>
  );
}

export default Footer;