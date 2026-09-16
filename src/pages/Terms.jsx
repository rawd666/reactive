import { Check } from "lucide-react";
import Seo from "../components/common/Seo";
import { PLANS } from "../data/plans";

export const TERMS_VERSION = "2026-08-19";

function Terms() {
  return (
    <section className="rx-section">
      <Seo
        path="/terms"
        title="Terms & Conditions"
        description="The terms that govern website projects purchased through Reactive, including scope, fees, ownership, and support."
      />
      <div className="rx-wrap">
        <div className="rx-eyebrow">legal</div>
        <h1 className="rx-h1" style={{ fontSize: "clamp(34px,5vw,56px)" }}>
          Terms &amp; Conditions
        </h1>
        <p className="rx-lead" style={{ marginTop: 20 }}>
          Last updated: August 19, 2026. This Agreement governs any project purchased through this
          site between Reactive ("Developer") and the purchasing individual or business ("Client").
          By checking the agreement box at checkout and completing payment, Client agrees to be
          bound by these terms.
        </p>

        <div style={{ maxWidth: 760, marginTop: 48 }}>
          <h2 className="rx-h3" style={{ marginBottom: 8 }}>1. Scope of services</h2>
          <p style={{ marginBottom: 12 }}>
            Client is purchasing one of the packages described on the Packages page at the time of
            checkout. Each package includes exactly the pages, features, revision rounds, and
            post-launch support period listed for that package below. Nothing outside that list is
            included, regardless of anything discussed informally before the contract is signed.
          </p>
          <div className="rx-notes-grid" style={{ marginTop: 20, marginBottom: 12 }}>
            {PLANS.map((plan) => (
              <div key={plan.id}>
                <h3 className="rx-h3">{plan.name}</h3>
                <ul className="rx-price-features">
                  {plan.features.map((f, i) => (
                    <li key={i}>
                      <Check size={14} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>2. Out-of-scope work</h2>
          <p style={{ marginBottom: 12 }}>
            Any request beyond the included pages, features, or revision rounds for Client's
            package — including additional pages, additional revision rounds, new features, or an
            expanded scope from what was described at the time of purchase — is Out-of-Scope Work.
            Out-of-Scope Work is not covered by fees already paid. It will be scoped, quoted, and
            confirmed in writing, and requires a new agreement and separate payment before Developer
            begins that work.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>3. Fees &amp; payment</h2>
          <p style={{ marginBottom: 12 }}>
            The one-time setup fee for Client's selected package is due in full at checkout before
            work begins. The monthly hosting &amp; upkeep fee is billed automatically starting at
            checkout and continues monthly until cancelled by either party with at least 30 days'
            written notice. Fees already paid are non-refundable once work has begun, except where
            required by applicable law.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>4. Client responsibilities</h2>
          <p style={{ marginBottom: 12 }}>
            Client agrees to provide timely feedback, content, and access (e.g. accounts, assets, or
            approvals) reasonably needed for Developer to complete the project. Delays caused by
            Client in providing these may delay delivery and do not extend any post-launch support
            period.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>5. Ownership of deliverables</h2>
          <p style={{ marginBottom: 12 }}>
            Upon receipt of full payment for the applicable package, Developer assigns to Client
            ownership of the final custom code created specifically for Client's project
            ("Deliverables"). This does not include: (a) Developer's own general-purpose tools,
            boilerplate, or frameworks used to build the Deliverables, which Developer may reuse on
            other projects; (b) third-party software, libraries, plugins, fonts, or stock assets,
            which remain subject to their own licenses; or (c) the license Developer retains under
            Section 6 below.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>6. Portfolio &amp; open-source license</h2>
          <p style={{ marginBottom: 12 }}>
            Developer retains the right to (a) display the delivered site and a general description
            of the project in Developer's professional portfolio, and (b) publish the project's
            source code publicly on Developer's GitHub (or a successor code-hosting platform) for
            portfolio and open-source purposes.
          </p>
          <p style={{ marginBottom: 12 }}>
            This license does not extend to, and Developer will not publish: Client's private API
            keys, credentials, or configuration secrets; Client's customer, employee, or business
            contact data; content Client has identified in writing as confidential; or any material
            Client does not have the right to make public. Client may request in writing, before
            project completion, that the source code not be published publicly, and Developer will
            accommodate reasonable requests.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>7. Confidentiality</h2>
          <p style={{ marginBottom: 12 }}>
            Each party agrees to keep the other's non-public business information confidential and
            to use it only to perform this Agreement, except for the license Developer retains under
            Section 6.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>8. Independent contractor</h2>
          <p style={{ marginBottom: 12 }}>
            Developer is an independent contractor, not an employee, partner, or agent of Client.
            Developer is solely responsible for his own
            taxes, insurance, and business expenses in his own jurisdiction. Client is not
            responsible for withholding taxes on Developer's behalf, and Developer is not obligated
            to provide tax documentation to Client. Developer may, at his discretion, provide
            standard tax forms (e.g. IRS Form W-8BEN) if reasonably requested.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>9. Warranties &amp; disclaimer</h2>
          <p style={{ marginBottom: 12 }}>
            Developer will perform services in a professional manner consistent with industry
            standards. Except as expressly stated in this Agreement, Deliverables are provided "as
            is," without warranties of any kind, express or implied, including fitness for a
            particular purpose, merchantability, or non-infringement of third-party content supplied
            by Client.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>10. Limitation of liability</h2>
          <p style={{ marginBottom: 12 }}>
            To the maximum extent permitted by law, Developer's total liability arising out of this
            Agreement will not exceed the fees Client actually paid to Developer in the three (3)
            months preceding the claim. Developer is not liable for indirect, incidental,
            consequential, or punitive damages, including lost profits or lost data, even if advised
            of the possibility of such damages.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>11. Indemnification</h2>
          <p style={{ marginBottom: 12 }}>
            Client agrees to indemnify and hold Developer harmless from claims, damages, or expenses
            (including reasonable attorney's fees) arising from: (a) content or materials Client
            provides for use on the site, including any claim that such content infringes a third
            party's rights; or (b) Client's use of the Deliverables in violation of this Agreement or
            applicable law.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>12. Termination</h2>
          <p style={{ marginBottom: 12 }}>
            Either party may terminate this Agreement with written notice. If Client terminates
            before a package is complete, fees paid for work already performed are non-refundable,
            and Developer will deliver the work completed to date on request. If Developer
            terminates, Developer will refund fees paid for work not yet performed. Monthly hosting
            &amp; upkeep may be cancelled by either party with 30 days' notice.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>13. Force majeure</h2>
          <p style={{ marginBottom: 12 }}>
            Neither party is liable for delay or failure to perform caused by events beyond its
            reasonable control, including natural disasters, internet or infrastructure outages, or
            other circumstances that could not reasonably be planned for.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>14. Governing law &amp; disputes</h2>
          <p style={{ marginBottom: 12 }}>
            This Agreement is governed by the laws of the State of California, without regard to
            conflict-of-laws principles. The parties will first attempt to resolve any dispute
            through good-faith negotiation. If unresolved within 30 days, either party may bring the
            dispute in the state or federal courts located in California, and each party consents to
            the personal jurisdiction of those courts.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>15. General</h2>
          <p style={{ marginBottom: 12 }}>
            This Agreement is the entire agreement between the parties regarding the project and
            supersedes prior discussions on the same subject. If any provision is found
            unenforceable, the remaining provisions stay in effect. This Agreement may only be
            amended in writing signed or acknowledged by both parties. Notices may be sent by email
            to the addresses used to place and confirm the order.
          </p>

          <h2 className="rx-h3" style={{ marginBottom: 8, marginTop: 36 }}>16. Acceptance</h2>
          <p style={{ marginBottom: 12 }}>
            By checking "I agree" at checkout and completing payment, Client acknowledges having
            read and understood this Agreement, including the package-specific terms in Section 1,
            and agrees to be bound by it. This action, together with Developer's record of the
            transaction (subscription ID and timestamp), constitutes Client's electronic signature
            and acceptance under the U.S. Electronic Signatures in Global and National Commerce Act
            (E-SIGN Act) and other applicable electronic transaction laws.
          </p>

          <p style={{ marginTop: 36, fontSize: 13, color: "var(--color-gray-mid)" }}>
            Questions about these terms? Reach out via the <a href="/contact">contact page</a>{" "}
            before purchasing.
          </p>
        </div>
      </div>
    </section>
  );
}

export default Terms;
