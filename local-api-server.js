// Local API server for Resend email (runs on port 3000)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// API endpoint for sending emails
app.post('/api/send-email', async (req, res) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set in .env file');
    return res.status(500).json({ error: 'Email service not configured. Please check your .env file.' });
  }

  try {
    const { to, subject, text, replyTo } = req.body;

    // Validate required fields
    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get from email from environment or use default
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    console.log('Sending email via Resend API...');
    console.log('From:', fromEmail);
    console.log('To:', to);
    console.log('Subject:', subject);
    
    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject,
        text: text,
        reply_to: replyTo || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', data);
      return res.status(response.status).json({ 
        error: data.message || 'Failed to send email',
        details: data 
      });
    }

    console.log('Email sent successfully! ID:', data.id);
    return res.status(200).json({ 
      success: true, 
      id: data.id 
    });

  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Local API server is running' });
});

app.listen(PORT, () => {
  console.log(`\n✅ Local API server running on http://localhost:${PORT}`);
  console.log(`📧 Resend API endpoint: http://localhost:${PORT}/api/send-email`);
  console.log(`🔑 API Key loaded: ${process.env.RESEND_API_KEY ? 'Yes' : 'No'}\n`);
});
