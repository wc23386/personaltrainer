// Vercel serverless function to send emails via Resend API
export default async function handler(req, res) {
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
    const { to, subject, text, replyTo } = req.body;

    // Validate required fields
    if (!to || !subject || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

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
        subject: subject,
        text: text,
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
      error: 'Internal server error' 
    });
  }
}
