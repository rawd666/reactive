import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config(); // Load environment variables from .env file

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

const app = express();

// Traefik sits in front of this app as a single reverse-proxy hop (see docker-compose.yaml),
// so req.ip should be read from the first X-Forwarded-For entry rather than the socket address.
app.set('trust proxy', 1);

// Only the site itself (and any extra origins set via ALLOWED_ORIGINS) may call these APIs.
// Requests with no Origin header (curl, server-to-server) are left unblocked since they aren't
// the browser cross-origin case CORS protects against.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://reactiveweb.dev')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
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

// Tracks subscription IDs that have already triggered activation emails, so a replayed
// request can't resend them. Resets on server restart; fine at this app's scale/traffic.
const activatedSubscriptionIDs = new Set();

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
  const { subscriptionID, planId, agreedToTerms, termsVersion } = req.body;

  if (!subscriptionID || !planId) {
    return res.status(400).json({ error: 'Missing subscription details' });
  }

  if (agreedToTerms !== true || !termsVersion) {
    return res.status(400).json({ error: 'You must agree to the Terms & Conditions to subscribe' });
  }

  if (activatedSubscriptionIDs.has(subscriptionID)) {
    return res.status(200).json({ message: 'Subscription already activated' });
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

    // Mark as activated before sending mail so two near-simultaneous requests for the same
    // subscription can't both slip past the check above and double-send.
    if (activatedSubscriptionIDs.has(subscriptionID)) {
      return res.status(200).json({ message: 'Subscription already activated' });
    }
    activatedSubscriptionIDs.add(subscriptionID);

    const subscriberEmail = subscription.subscriber?.email_address;
    const subscriberName = subscription.subscriber?.name?.given_name || 'there';

    transporter.sendMail(
      {
        from: process.env.GMAIL_USER,
        to: process.env.GMAIL_USER,
        subject: `New subscription: ${planId}`,
        text: `A new subscription was confirmed.\n\nPlan: ${planId}\nSubscription ID: ${subscriptionID}\nSubscriber email: ${subscriberEmail || 'unknown'}\n\nTerms & Conditions accepted: yes (version ${termsVersion})\nAccepted at: ${new Date().toISOString()}\nRequest IP: ${req.ip}`,
      },
      (error) => {
        if (error) console.error('Failed to send owner notification email:', error);
      }
    );

    if (subscriberEmail) {
      transporter.sendMail(
        {
          from: process.env.GMAIL_USER,
          to: subscriberEmail,
          subject: `You're subscribed to the ${planId} plan`,
          text: `Hi ${subscriberName},\n\nThanks for subscribing! Your payment went through and your ${planId} plan is now active.\n\nI'll be in touch within 1-2 business days to kick things off. If you have any questions in the meantime, just reply to this email.\n\nThanks,\nRawd`,
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

app.listen(5173, () => console.log('Server running on port 5173'));