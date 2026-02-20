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
app.use(express.json({ limit: '10kb' })); // Limit request body size

// Input sanitization functions
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  // Remove HTML tags
  let sanitized = input.replace(/<[^>]*>/g, '');
  // Remove script tags and event handlers
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  return sanitized.trim();
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Validation functions
function validateName(name) {
  if (!name || name.length === 0 || name.length > 50) return false;
  const namePattern = /^[\u4e00-\u9fa5a-zA-Z\s\.\-\'\(\)]+$/;
  return namePattern.test(name);
}

function validatePhone(phone) {
  if (!phone) return false;
  const digitsOnly = phone.replace(/[^0-9]/g, '');
  return digitsOnly.length === 10 && /^[0-9]{10}$/.test(digitsOnly);
}

function validateLineId(lineId) {
  if (!lineId || lineId.length === 0) return true; // Optional
  if (lineId.length > 50) return false;
  const lineIdPattern = /^[a-zA-Z0-9_\.\-]+$/;
  return lineIdPattern.test(lineId);
}

function validateContactTime(contactTime) {
  const allowedValues = ['早上(8~12點)', '中午(13~18點)', '晚上(19~22點)'];
  return contactTime && allowedValues.includes(contactTime);
}

function validateGoal(goal) {
  const allowedValues = ['減肥', '瘦身', '健康', '固定運動', '企業合作'];
  return goal && allowedValues.includes(goal);
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && email.length <= 254;
}

// API endpoint for sending emails
app.post('/api/send-email', async (req, res) => {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set in .env file');
    return res.status(500).json({ error: 'Email service not configured. Please check your .env file.' });
  }

  try {
    let { to, subject, text, replyTo } = req.body;

    // Validate required fields
    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Sanitize all inputs
    to = sanitizeInput(String(to));
    subject = sanitizeInput(String(subject));
    text = sanitizeInput(String(text));
    if (replyTo) {
      replyTo = sanitizeInput(String(replyTo));
    }

    // Validate email format
    if (!validateEmail(to)) {
      console.error('Invalid email format:', to);
      return res.status(400).json({ error: 'Invalid email address format' });
    }

    // Validate subject length (max 200 characters)
    if (subject.length > 200) {
      return res.status(400).json({ error: 'Subject too long (max 200 characters)' });
    }

    // Validate text length (max 10000 characters)
    if (text.length > 10000) {
      return res.status(400).json({ error: 'Message too long (max 10000 characters)' });
    }

    // Validate replyTo email format if provided
    if (replyTo && !validateEmail(replyTo)) {
      console.error('Invalid replyTo email format:', replyTo);
      return res.status(400).json({ error: 'Invalid reply-to email address format' });
    }

    // Additional security: Check for suspicious patterns in text
    const suspiciousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(text) || pattern.test(subject)) {
        console.error('Suspicious content detected:', pattern);
        return res.status(400).json({ error: 'Invalid content detected' });
      }
    }

    // Escape HTML in text before sending
    const safeText = escapeHtml(text);
    const safeSubject = escapeHtml(subject);

    // Get from email from environment or use default
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    console.log('Sending email via Resend API...');
    console.log('From:', fromEmail);
    console.log('To:', to);
    console.log('Subject:', safeSubject);
    
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
        subject: safeSubject,
        text: safeText,
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
