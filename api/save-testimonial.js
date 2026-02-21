// Vercel serverless: append testimonial to _data/testimonials.yml + optional image to img/testimonials/
// Env: GITHUB_TOKEN, GITHUB_REPO, GITHUB_BRANCH (optional)

const GITHUB_API = 'https://api.github.com';
const TESTIMONIALS_PATH = '_data/testimonials.yml';

function escapeYamlValue(str) {
  if (str == null) return '';
  const s = String(str).trim();
  if (!s) return '';
  if (/[:"#[\]{}|>*]/.test(s) || s.includes("'")) return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  return s;
}

function contentBlock(str) {
  if (str == null) return '';
  const s = String(str).trim();
  if (!s) return '';
  if (/\n/.test(s)) {
    const lines = s.split(/\r?\n/).map(l => '  ' + l);
    return '|\n' + lines.join('\n');
  }
  return escapeYamlValue(s);
}

async function getFile(owner, repo, path, branch, token) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status !== 200) return { sha: null, content: null };
  const data = await res.json();
  const content = data.content ? Buffer.from(data.content, 'base64').toString('utf8') : null;
  return { sha: data.sha, content };
}

async function putFile(owner, repo, path, content, message, branch, token, sha = null) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const base64 = Buffer.isBuffer(content) ? content.toString('base64') : Buffer.from(content, 'utf8').toString('base64');
  const body = { message, content: base64, branch };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`GitHub API: ${res.status} ${await res.text()}`);
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repoFull) {
    const missing = []; if (!token) missing.push('GITHUB_TOKEN'); if (!repoFull) missing.push('GITHUB_REPO');
    return res.status(500).json({
      error: 'Server not configured. In Vercel: Settings → Environment Variables, add ' + missing.join(' and ') + ', then redeploy.',
    });
  }

  const [owner, repo] = repoFull.split('/').filter(Boolean);
  if (!owner || !repo) return res.status(500).json({ error: 'Invalid GITHUB_REPO' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { name, category, content, instagram, image: imagePayload } = body;
  if (!name || !category || content == null) {
    return res.status(400).json({ error: 'Missing required fields: name, category, content' });
  }

  const slug = String(name).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u4e00-\u9fff-]/g, '').slice(0, 30) || 'testimonial';
  const imgExt = (imagePayload && imagePayload.extension) ? String(imagePayload.extension).replace(/^\./, '').toLowerCase() : 'jpg';
  const imagePath = (imagePayload && imagePayload.data) ? `/img/testimonials/${slug}.${imgExt}` : '/img/testimonials/default.jpg';

  const { sha: yamlSha, content: existingYaml } = await getFile(owner, repo, TESTIMONIALS_PATH, branch, token);
  const trimmed = (existingYaml || '').trimEnd();
  const newEntry = [
    '',
    '- name: ' + escapeYamlValue(name),
    '  image: ' + imagePath,
    '  category: ' + escapeYamlValue(category),
    '  content: ' + contentBlock(content),
    '  instagram: ' + (instagram && String(instagram).trim() ? escapeYamlValue(instagram) : 'https://www.instagram.com/givespower.health'),
  ].join('\n');
  const newYaml = trimmed + newEntry + '\n';

  try {
    await putFile(owner, repo, TESTIMONIALS_PATH, newYaml, 'Add testimonial: ' + name, branch, token, yamlSha);
  } catch (err) {
    console.error('save-testimonial yaml:', err);
    return res.status(500).json({ error: err.message || 'Failed to save testimonial' });
  }

  if (imagePayload && imagePayload.data) {
    if (!/^(jpe?g|png|gif|webp)$/.test(imgExt)) {
      return res.status(400).json({ error: 'Image type not allowed (use jpg, png, gif, webp)' });
    }
    let buf;
    try {
      buf = Buffer.from(imagePayload.data, 'base64');
    } catch (e) {
      return res.status(400).json({ error: 'Invalid image base64' });
    }
    if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 4MB)' });
    const imgPath = `img/testimonials/${slug}.${imgExt}`;
    const { sha: imgSha } = await getFile(owner, repo, imgPath, branch, token);
    try {
      await putFile(owner, repo, imgPath, buf, 'Add testimonial image: ' + slug, branch, token, imgSha);
    } catch (err) {
      console.error('save-testimonial image:', err);
    }
  }

  return res.status(200).json({
    success: true,
    message: '成功案例已儲存。請執行 git pull 取得更新，或等正式站重新建站後於成功案例頁面查看。',
  });
}
