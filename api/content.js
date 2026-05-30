import { savePost, saveTestimonial, verifyEditorAccess } from './content-service.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  try {
    const auth = await verifyEditorAccess(req);
    if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });

    if (body.type === 'post') {
      return res.status(200).json(await savePost(body.data, auth.email));
    }
    if (body.type === 'testimonial') {
      return res.status(200).json(await saveTestimonial(body.data, auth.email));
    }
    return res.status(400).json({ error: 'Invalid content type. Use post or testimonial.' });
  } catch (err) {
    console.error('content api error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to save content' });
  }
}
