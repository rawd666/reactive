import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import { PAGES } from "../../data/pages";

function Nav() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setOpen(false);

  const goToContact = () => {
    closeMenu();
    navigate("/contact");
  };

  return (
    <nav className="rx-nav">
      <div className="rx-wrap rx-nav-inner">
        <NavLink to="/" aria-label="Reactive home" onClick={closeMenu}>
          <Logo />
        </NavLink>

        <div className="rx-navlinks-desktop">
          {PAGES.map((p) => (
            <NavLink
              key={p.path}
              to={p.path}
              end={p.path === "/"}
              className={({ isActive }) => `rx-navlink${isActive ? " active" : ""}`}
            >
              {p.label}
            </NavLink>
          ))}
          <button className="rx-cta" onClick={goToContact}>
            Start a project
          </button>
        </div>

        <button
          className="rx-navtoggle"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {open && (
        <div className="rx-navlinks-mobile">
          {PAGES.map((p) => (
            <NavLink
              key={p.path}
              to={p.path}
              end={p.path === "/"}
              className={({ isActive }) => `rx-navlink${isActive ? " active" : ""}`}
              onClick={closeMenu}
            >
              {p.label}
            </NavLink>
          ))}
          <button className="rx-cta" onClick={goToContact}>
            Start a project
          </button>
        </div>
      )}
    </nav>
  );
}

export default Nav;