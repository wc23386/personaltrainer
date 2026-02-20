// Vercel serverless function to send emails via Resend API

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

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && email.length <= 254;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get Resend API key from environment variables
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Email service not configured' });
  }

  try {
    // Parse request body
    let body;
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body;
    }

    let { to, subject, text, replyTo } = body;

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
    // For Resend free tier, you can use: onboarding@resend.dev (for testing)
    // For production, use your verified domain: noreply@yourdomain.com
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
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
        error: data.message || 'Failed to send email' 
      });
    }

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
}
