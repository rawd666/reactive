import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import adminRouter from './server/admin.js';
import { registerClient } from './server/db.js';
import { planMeta } from './server/plan-meta.js';
import { initAdminConfig } from './server/auth.js';

dotenv.config({ quiet: true }); // Load environment variables from .env file

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

const app = express();

// Traefik sits in front of this app as a single reverse-proxy hop (see docker-compose.yaml),
// so req.ip should be read from the first X-Forwarded-For entry rather than the socket address.
app.set('trust proxy', 1);

// Only the site itself (and any extra origins set via ALLOWED_ORIGINS) may call these APIs.
// Requests with no Origin header (curl, server-to-server) are left unblocked since they aren't
// the browser cross-origin case CORS protects against.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://reactiveweb.dev')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// In dev the browser talks to Vite on 5173 and Vite proxies to this server, forwarding
// the original Origin — so localhost has to be allowed or every form and the admin
// sign-in gets a 403. Any port, since Vite moves to 5174+ when 5173 is taken.
// Never in production: there, the only allowed origins are the configured ones.
const LOCALHOST_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return !IS_PRODUCTION && LOCALHOST_ORIGIN.test(origin);
}

app.use(cors({
  credentials: true, // the admin session cookie rides on these requests
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

app.use(express.json());
app.use(express.static(distPath)); // Serve static files from the dist directory

// Maps the human-readable package id to the real PayPal plan id, so the server can
// confirm the paid subscription actually matches the package being activated.
const PLAN_ID_MAP = {
  launch: process.env.VITE_PAYPAL_PLAN_LAUNCH,
  grow: process.env.VITE_PAYPAL_PLAN_GROW,
  scale: process.env.VITE_PAYPAL_PLAN_SCALE,
};

// Replay protection now lives in the database: clients.subscription_id is UNIQUE, so a
// repeated activation finds the existing row instead of registering or emailing twice.
// That also survives a restart, which the previous in-memory Set did not.

// Seeds the admin login when .env doesn't set one, so /admin always works.
initAdminConfig();
app.use('/api/admin', adminRouter);

const activateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// The address clients see in their inbox. Gmail silently rewrites this to the
// authenticated account UNLESS the address is verified under
// Gmail → Settings → Accounts → "Send mail as". Override with MAIL_FROM in .env.
const MAIL_FROM = process.env.MAIL_FROM || 'Reactive <rawd@reactiveweb.dev>';

// Configure the email transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,        // Gmail address
    pass: process.env.GMAIL_APP_PASSWORD // 16-character Gmail App Password
  }
});

// Exchanges the PayPal client credentials for a short-lived API access token
async function getPayPalAccessToken() {
  const auth = Buffer.from(
    `${process.env.VITE_PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const response = await fetch(`${process.env.PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) throw new Error('Failed to authenticate with PayPal');
  const data = await response.json();
  return data.access_token;
}

// Confirms a subscription is really active with PayPal before treating the checkout as paid
app.post('/api/subscription/activate', activateLimiter, async (req, res) => {
  const { subscriptionID, planId, agreedToTerms, termsVersion, agreedToPrivacy, privacyVersion, businessName, agreedToContract } = req.body;

  if (!subscriptionID || !planId) {
    return res.status(400).json({ error: 'Missing subscription details' });
  }

  if (agreedToTerms !== true || !termsVersion) {
    return res.status(400).json({ error: 'You must agree to the Terms & Conditions to subscribe' });
  }

  if (agreedToPrivacy !== true || !privacyVersion) {
    return res.status(400).json({ error: 'You must agree to the Privacy Policy to subscribe' });
  }

  if (agreedToContract !== true) {
    return res.status(400).json({ error: 'You must confirm the project agreement to subscribe' });
  }

  try {
    const accessToken = await getPayPalAccessToken();

    const subResponse = await fetch(
      `${process.env.PAYPAL_API_BASE}/v1/billing/subscriptions/${subscriptionID}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!subResponse.ok) throw new Error('Could not verify subscription with PayPal');
    const subscription = await subResponse.json();

    if (subscription.status !== 'ACTIVE') {
      return res.status(402).json({ error: 'Subscription is not active' });
    }

    const expectedPlanId = PLAN_ID_MAP[planId];
    if (!expectedPlanId || subscription.plan_id !== expectedPlanId) {
      return res.status(400).json({ error: 'Subscription plan does not match the requested package' });
    }

    const subscriberEmail = subscription.subscriber?.email_address;
    const subscriberName = subscription.subscriber?.name?.given_name || 'there';
    const fullName = [
      subscription.subscriber?.name?.given_name,
      subscription.subscriber?.name?.surname,
    ]
      .filter(Boolean)
      .join(' ');
    const meta = planMeta(planId);

    // Registering before sending mail is what prevents a double-send: the UNIQUE
    // constraint on subscription_id makes the second concurrent request return created=false.
    const { client, created } = registerClient({
      subscriptionId: subscriptionID,
      email: subscriberEmail || 'unknown',
      contactName: fullName || null,
      businessName: typeof businessName === 'string' ? businessName.trim() || null : null,
      planId,
      termsVersion,
      privacyVersion,
      revisionsIncluded: meta.revisionRounds,
      supportDays: meta.supportDays,
      contractAgreed: agreedToContract === true,
    });

    if (!created) {
      return res.status(200).json({ message: 'Subscription already activated' });
    }

    transporter.sendMail(
      {
        from: MAIL_FROM,
        to: process.env.GMAIL_USER,
        subject: `New subscription: ${planId} (${client.client_code})`,
        text: `A new subscription was confirmed and registered.\n\nClient ID: ${client.client_code}\nBusiness: ${client.business_name || '(not provided — set it in /admin)'}\nPlan: ${planId}\nSubscription ID: ${subscriptionID}\nSubscriber: ${fullName || 'unknown'}\nSubscriber email: ${subscriberEmail || 'unknown'}\n\nRevisions included: ${meta.revisionRounds ?? 'unlimited'}\nSupport ends: ${client.support_ends_at || 'n/a'}\n\nTerms & Conditions accepted: yes (version ${termsVersion})\nPrivacy Policy accepted: yes (version ${privacyVersion})\nProject agreement confirmed: yes\nAccepted at: ${new Date().toISOString()}\nRequest IP: ${req.ip}`,
      },
      (error) => {
        if (error) console.error('Failed to send owner notification email:', error);
      }
    );

    if (subscriberEmail) {
      transporter.sendMail(
        {
          from: MAIL_FROM,
          to: subscriberEmail,
          subject: `Payment confirmed — your client ID is ${client.client_code}`,
          text: [
            `Hi ${subscriberName},`,
            ``,
            `Thanks — your payment went through. This email is your receipt.`,
            ``,
            `  Client ID         ${client.client_code}`,
            `  Package           ${meta.name || planId}`,
            `  Setup fee         ${meta.price || '—'} (paid)`,
            `  Hosting & upkeep  ${meta.monthly || '—'}/month`,
            `  Date              ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
            `  Subscription ID   ${subscriptionID}`,
            ``,
            `Keep your client ID somewhere handy and quote it in any email about your`,
            `project — it's how I pull up your build at a glance.`,
            ``,
            `I'll be in touch within 1-2 business days to get started. Any questions in`,
            `the meantime, just reply to this email.`,
            ``,
            `Rawd`,
            `Reactive · reactiveweb.dev`,
          ].join('\n'),
        },
        (error) => {
          if (error) console.error('Failed to send customer confirmation email:', error);
        }
      );
    }

    res.status(200).json({ message: 'Subscription activated' });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: 'Failed to verify subscription' });
  }
});

// Post route to handle form submission
app.post('/api/contact', contactLimiter, (req, res) => {
  const { name, email, business, package: selectedPackage, message } = req.body;

  const mailOptions = {
    from: email,
    to: process.env.GMAIL_USER, // Sends the email to yourself
    subject: `New Contact Form Submission from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nBusiness: ${business}\nPackage: ${selectedPackage}\nMessage: ${message}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Failed to send email' });
    }
    res.status(200).json({ message: 'Email sent successfully!' });
  });
});

// Fallback: serve index.html for any other GET request so React Router can handle client-side routes
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Catches the error the cors() middleware raises for disallowed origins, so it returns a
// plain 403 instead of falling through to Express's default error handler.
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  next(err);
});

// Configurable so `npm run dev` (Vite on 5173) and the API can run side by side locally.
const PORT = process.env.PORT || 5173;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));