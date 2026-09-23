import { useEffect, lazy, Suspense } from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Nav from "./components/layout/Nav";
import Footer from "./components/layout/Footer";

import Home from "./pages/Home";
import Packages from "./pages/Packages";
import Contact from "./pages/Contact";
import Checkout from "./pages/Checkout";
import ThankYou from "./pages/ThankYou";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

// Lazy-loaded so the admin dashboard isn't part of the bundle every visitor downloads.
const Admin = lazy(() => import("./pages/Admin"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

function App() {
  return (
    <div className="reactive-root">
      <ScrollToTop />
      <Nav />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/checkout/thank-you" element={<ThankYou />} />
          <Route path="/checkout/:planId" element={<Checkout />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          {/* /admin/* — the dashboard routes its own sections (see SECTIONS in Admin.jsx). */}
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={null}>
                <Admin />
              </Suspense>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;