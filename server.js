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