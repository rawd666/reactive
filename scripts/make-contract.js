/**
 * Generates a signable contract PDF from the live terms in src/data/terms.js.
 *
 *   npm run contract              -> Grow package (default)
 *   npm run contract -- launch    -> a different package
 *
 * Two guarantees:
 *   1. The PDF is always built from the current terms. There is no second copy
 *      of the text to fall out of date.
 *   2. Every terms version that has ever produced a contract is archived under
 *      contracts/terms-versions/<version>.json. If the wording changes without
 *      TERMS_VERSION being bumped, this script refuses to run, so an archived
 *      version can never silently mean two different things.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { TERMS, TERMS_VERSION, TERMS_LAST_UPDATED } from "../src/data/terms.js";
import { PLANS } from "../src/data/plans.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "contracts");
const ARCHIVE_DIR = path.join(OUT_DIR, "terms-versions");

const DEVELOPER = {
  name: "Reactive",
  email: "rawd@reactiveweb.dev",
  phone: "+1 (949) 883-0458",
};

const PINK = "#ff1f7d";
const INK = "#1a1a1a";
const MUTED = "#666666";
const RULE = "#d8d8d8";
const BLANK = "________________________________";

/* ---------------- resolve package ---------------- */

const planId = (process.argv[2] || "grow").toLowerCase();
const plan = PLANS.find((p) => p.id === planId);
if (!plan) {
  console.error(
    `Unknown package "${planId}". Available: ${PLANS.map((p) => p.id).join(", ")}`
  );
  process.exit(1);
}

/* ---------------- optional per-client details ---------------- */

// npm run contract -- grow contracts/clients/blooming-flowers.json
//
// Anything the file leaves out falls back to a blank line to fill in by hand.
// Custom clauses go in "addendum" as an array of paragraphs; they print as their
// own numbered section so the shared terms in src/data/terms.js stay untouched.
const detailsPath = process.argv[3];
const details = detailsPath
  ? JSON.parse(fs.readFileSync(path.resolve(ROOT, detailsPath), "utf8"))
  : {};

const slug = (details.businessName || "")
  .trim()
  .replace(/[^A-Za-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

/* ---------------- archive the terms version ---------------- */

fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
const archivePath = path.join(ARCHIVE_DIR, `${TERMS_VERSION}.json`);
const snapshot = {
  version: TERMS_VERSION,
  lastUpdated: TERMS_LAST_UPDATED,
  sections: TERMS,
};

if (fs.existsSync(archivePath)) {
  const stored = JSON.parse(fs.readFileSync(archivePath, "utf8"));
  const same =
    JSON.stringify(stored.sections) === JSON.stringify(snapshot.sections) &&
    stored.lastUpdated === snapshot.lastUpdated;
  if (!same) {
    console.error(
      `\nTerms version "${TERMS_VERSION}" is already archived, but the wording in\n` +
        `src/data/terms.js no longer matches that archive.\n\n` +
        `A signed contract points at a version, so a version must never change meaning.\n` +
        `Bump TERMS_VERSION (and TERMS_LAST_UPDATED) in src/data/terms.js, then re-run.\n\n` +
        `  archived: ${path.relative(ROOT, archivePath)}\n`
    );
    process.exit(1);
  }
} else {
  snapshot.firstUsedAt = new Date().toISOString();
  fs.writeFileSync(archivePath, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`archived terms version -> ${path.relative(ROOT, archivePath)}`);
}

/* ---------------- build the pdf ---------------- */

const outPath = path.join(
  OUT_DIR,
  slug
    ? `Reactive-${plan.name}-Agreement-${slug}-${TERMS_VERSION}.pdf`
    : `Reactive-${plan.name}-Agreement-${TERMS_VERSION}.pdf`
);

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 62, bottom: 66, left: 64, right: 64 },
  bufferPages: true,
  info: {
    Title: `Website Design & Development Agreement - ${plan.name} Package`,
    Author: DEVELOPER.name,
    Subject: `Terms version ${TERMS_VERSION}`,
  },
});
const out = fs.createWriteStream(outPath);
out.on("error", (err) => {
  if (err.code === "EBUSY" || err.code === "EPERM" || err.code === "EACCES") {
    console.error(
      `\nCould not write ${path.relative(ROOT, outPath)} — the file is open in another program.\n` +
        `Close it (a PDF viewer holds the lock on Windows) and run this again.\n`
    );
  } else {
    console.error(`\nCould not write ${path.relative(ROOT, outPath)}: ${err.message}\n`);
  }
  process.exit(1);
});
doc.pipe(out);

const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;

function rule() {
  const y = doc.y + 6;
  doc.save().strokeColor(RULE).lineWidth(0.75)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.margins.left + W, y)
    .stroke()
    .restore();
  doc.y = y + 12;
}

function heading(text) {
  if (doc.y > doc.page.height - 150) doc.addPage();
  doc.moveDown(0.9);
  doc.font("Helvetica-Bold").fontSize(10.5).fillColor(PINK)
    .text(text.toUpperCase(), { characterSpacing: 0.4 });
  doc.moveDown(0.35);
}

function para(text) {
  doc.font("Helvetica").fontSize(9.8).fillColor(INK)
    .text(text, { align: "justify", lineGap: 2.2 });
  doc.moveDown(0.5);
}

function field(label, value) {
  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED)
    .text(label.toUpperCase(), doc.page.margins.left, y, {
      width: 150,
      characterSpacing: 0.3,
    });
  doc.font("Helvetica").fontSize(10).fillColor(INK)
    .text(value, doc.page.margins.left + 155, y, { width: W - 155 });
  doc.moveDown(0.55);
  doc.x = doc.page.margins.left;
}

function packageTable() {
  // A client file may restate the scope for a negotiated deal. When it does, the
  // agreed list is what this contract prints — src/data/plans.js and the public
  // Packages page are never edited for one customer.
  const customScope = Array.isArray(details.scope) && details.scope.length > 0;
  const features = customScope ? details.scope : plan.features;

  doc.moveDown(0.2);
  doc.font("Helvetica-Bold").fontSize(9.8).fillColor(INK)
    .text(`${plan.name} package — ${plan.price} ${plan.priceUnit}, plus ${plan.monthly}/month hosting & upkeep`);
  doc.moveDown(0.4);
  features.forEach((f) => {
    const y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9.8).fillColor(PINK)
      .text("-", doc.page.margins.left + 6, y, { width: 12 });
    doc.font("Helvetica").fontSize(9.8).fillColor(INK)
      .text(f, doc.page.margins.left + 20, y, { width: W - 20, lineGap: 2 });
    doc.moveDown(0.25);
  });
  doc.x = doc.page.margins.left;

  if (customScope) {
    doc.moveDown(0.15);
    doc.font("Helvetica-Oblique").fontSize(8.6).fillColor(MUTED)
      .text(
        `Scope agreed for this project. It replaces the standard ${plan.name} package list ` +
          `for this Agreement only.`
      );
    doc.fillColor(INK);
  }

  doc.moveDown(0.5);
}

/* header */

doc.font("Helvetica-Bold").fontSize(9).fillColor(PINK)
  .text(DEVELOPER.name.toUpperCase(), { characterSpacing: 1.6 });
doc.moveDown(0.5);
doc.font("Helvetica-Bold").fontSize(19).fillColor(INK)
  .text("Website Design & Development Agreement");
doc.moveDown(0.25);
doc.font("Helvetica").fontSize(11).fillColor(MUTED)
  .text(`${plan.name} Package  ·  Terms version ${TERMS_VERSION}`);
rule();

para(
  `This Agreement is entered into as of the Effective Date below, between ${DEVELOPER.name} ("Developer") ` +
    `and the individual or business identified below ("Client"). The terms below are the same terms ` +
    `published at reactiveweb.dev/terms as of version ${TERMS_VERSION} (${TERMS_LAST_UPDATED}).`
);

doc.moveDown(0.4);
field("Effective date", details.effectiveDate || BLANK);
field("Client name", details.clientName || BLANK);
field("Business name", details.businessName || BLANK);
field("Client email", details.email || BLANK);
field("Project / site", details.projectSite || BLANK);
field("Target launch date", details.targetLaunch || BLANK);
doc.moveDown(0.2);
field("Developer", DEVELOPER.name);
field("Developer email", DEVELOPER.email);
field("Developer phone", DEVELOPER.phone);
field("Selected package", `${plan.name} — ${plan.price} ${plan.priceUnit}, ${plan.monthly}/month`);
rule();

/* terms, straight from the live source */

for (const section of TERMS) {
  heading(`${section.n}.  ${section.title}`);
  section.body.forEach(para);
  if (section.showPackages) packageTable();
}

// Per-client clauses, printed after the shared terms so the published wording is
// never forked for one customer.
if (Array.isArray(details.addendum) && details.addendum.length > 0) {
  heading(`${TERMS.length + 1}.  Additional terms for this project`);
  details.addendum.forEach(para);
}

/* acceptance — no signature lines, this is accepted digitally at checkout */

if (doc.y > doc.page.height - 200) doc.addPage();
heading("How this agreement is accepted");
para(
  `There is nothing to sign. This Agreement takes effect when Client completes payment for the ` +
    `${plan.name} package through reactiveweb.dev, in the manner set out in Section 16. Completing ` +
    `that payment confirms that Client has read and understood this Agreement, including the ` +
    `package scope in Section 1.`
);
para(
  `Developer's record of that transaction — the PayPal subscription ID and its timestamp — is the ` +
    `record of acceptance, together with the client ID issued to Client by email at that time.`
);

/* footers */

const range = doc.bufferedPageRange();
for (let i = range.start; i < range.start + range.count; i++) {
  doc.switchToPage(i);
  // the footer sits below the bottom margin; without this pdfkit treats it as
  // overflow and appends a blank page for every footer written
  doc.page.margins.bottom = 0;
  const y = doc.page.height - 44;
  doc.font("Helvetica").fontSize(7.8).fillColor(MUTED)
    .text(
      `${DEVELOPER.name} — ${plan.name} Package Agreement — terms version ${TERMS_VERSION}`,
      doc.page.margins.left,
      y,
      { width: W * 0.72, lineBreak: false }
    );
  doc.font("Helvetica").fontSize(7.8).fillColor(MUTED)
    .text(`Page ${i - range.start + 1} of ${range.count}`, doc.page.margins.left + W - 120, y, {
      width: 120,
      align: "right",
      lineBreak: false,
    });
}

// doc.end() only starts the flush, so reporting success here would claim a write
// that can still fail afterwards — which is exactly what happened when the target
// PDF was open in a viewer. Wait for the stream to actually finish.
out.on("finish", () => {
  console.log(
    `wrote ${path.relative(ROOT, outPath)} (${range.count} pages, terms ${TERMS_VERSION})`
  );
});
doc.end();
