import { Routes, Route } from "react-router-dom";

import Nav from "./components/layout/Nav";
import Footer from "./components/layout/Footer";

import Home from "./pages/Home";
import Packages from "./pages/Packages";
import Contact from "./pages/Contact";

function App() {
  return (
    <div className="reactive-root">
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/contact" element={<Contact />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;