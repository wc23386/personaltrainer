import { savePost, verifyEditorAccess } from './content-service.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const auth = await verifyEditorAccess(req);
    if (!auth.ok) return res.status(auth.status || 401).json({ error: auth.error });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    return res.status(200).json(await savePost(body, auth.email));
  } catch (err) {
    console.error('save-post error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to save post' });
  }
}
