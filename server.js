import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const app = express();
app.use(express.json());
app.use(cors()); // Allows your React frontend to talk to this backend

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

app.listen(5173, () => console.log('Server running on port 5173'));