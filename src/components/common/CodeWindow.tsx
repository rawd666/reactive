function CodeWindow() {
  return (
    <div className="rx-code-window" aria-hidden="true">
      <div className="rx-code-bar">
        <span className="rx-dot" style={{ background: "#ff1f7d" }}></span>
        <span className="rx-dot" style={{ background: "#febc2e" }}></span>
        <span className="rx-dot" style={{ background: "#28c840" }}></span>
        <span className="rx-mono" style={{ marginLeft: 12, color: "var(--color-gray-mid)", fontSize: 12 }}>
          yourbusiness.jsx
        </span>
      </div>
      <pre className="rx-code-body rx-mono">
        <span className="rx-c-key">import</span> <span className="rx-c-var">YourBrand</span>{" "}
        <span className="rx-c-key">from</span> <span className="rx-c-str">'./identity'</span>;{"\n\n"}
        <span className="rx-c-key">export default function</span> Website() {"{\n"}
        {"  "}
        <span className="rx-c-key">return</span> ({"\n"}
        {"    "}
        <span className="rx-c-tag">&lt;Site&gt;</span>
        {"\n      "}
        <span className="rx-c-tag">&lt;Hero</span> <span className="rx-c-attr">brand</span>=
        <span className="rx-c-str">{"{YourBrand}"}</span> <span className="rx-c-tag">/&gt;</span>
        {"\n      "}
        <span className="rx-c-tag">&lt;Booking</span> <span className="rx-c-attr">enabled</span>{" "}
        <span className="rx-c-tag">/&gt;</span>
        {"\n      "}
        <span className="rx-c-tag">&lt;Shop</span> <span className="rx-c-attr">catalog</span>=
        <span className="rx-c-str">{"{products}"}</span> <span className="rx-c-tag">/&gt;</span>
        {"\n      "}
        <span className="rx-c-tag">&lt;WhateverYouNeed /&gt;</span>
        {"\n    "}
        <span className="rx-c-tag">&lt;/Site&gt;</span>
        {"\n  );\n}"}
      </pre>
    </div>
  );
}

export default CodeWindow;