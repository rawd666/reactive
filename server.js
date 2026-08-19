import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config(); // Load environment variables from .env file

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, 'dist');

const app = express();
app.use(express.json());
app.use(cors()); // Allows your React frontend to talk to this backend
app.use(express.static(distPath)); // Serve static files from the dist directory

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
app.post('/api/subscription/activate', async (req, res) => {
  const { subscriptionID, planId, agreedToTerms, termsVersion } = req.body;

  if (!subscriptionID || !planId) {
    return res.status(400).json({ error: 'Missing subscription details' });
  }

  if (agreedToTerms !== true || !termsVersion) {
    return res.status(400).json({ error: 'You must agree to the Terms & Conditions to subscribe' });
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
app.post('/api/contact', (req, res) => {
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

app.listen(5173, () => console.log('Server running on port 5173'));