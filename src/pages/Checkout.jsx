import { useParams } from "react-router-dom";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { PLANS } from "./plans";

function Checkout() {
  const { planId } = useParams();
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return <p>Plan not found</p>;

  return (
    <div className="rx-checkout">
      <h1>{plan.name}</h1>
      <p>{plan.price} setup · {plan.monthly}/mo</p>

      <PayPalScriptProvider
        options={{
          "client-id": "AZMPhU4xbIaEwiQNm_8Zr6ZJ_offSzJMmTzoESEGt6izSvyxY_hB1gsM35m7Kaiz5lnd9xLiFMF6K1cZ",
          components: "buttons",
          intent: "subscription",
          vault: true,
        }}
      >
        <PayPalButtons
          style={{ label: "subscribe" }}
          createSubscription={(data, actions) =>
            actions.subscription.create({ plan_id: plan.planId })
          }
          onApprove={async (data) => {
            await fetch("/api/subscription/activate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                subscriptionID: data.subscriptionID,
                planId: plan.id,
              }),
            });
            // redirect to a thank-you page
          }}
        />
      </PayPalScriptProvider>
    </div>
  );
}