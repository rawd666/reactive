import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";

function PriceCard({ plan }) {
  const navigate = useNavigate();

  return (
    <div className={`rx-price-card${plan.featured ? " featured" : ""}`}>
      {plan.badge && <div className="rx-price-badge rx-mono">{plan.badge}</div>}
      <div className="rx-price-name rx-mono">{plan.name}</div>
      <p className="rx-price-sub">{plan.sub}</p>
      <div className="rx-price-amount">
        {plan.price}
        <span className="rx-price-unit">{plan.priceUnit}</span>
      </div>
      <div className="rx-price-monthly rx-mono">
        + {plan.monthly}
        <span> /mo hosting &amp; upkeep</span>
      </div>
      <button
        className={`rx-btn rx-btn-full${plan.featured ? " rx-btn-primary" : " rx-btn-outline"}`}
        style={{ marginTop: 28 }}
        onClick={() => navigate("/contact")}
      >
        Start with {plan.name}
      </button>
      <ul className="rx-price-features">
        {plan.features.map((f, i) => (
          <li key={i}>
            <Check size={14} />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PriceCard;