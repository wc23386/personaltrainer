// Vercel serverless function: save blog post + optional image to GitHub repo
// Env: GITHUB_TOKEN (repo scope), GITHUB_REPO (owner/repo), GITHUB_BRANCH (optional, default main)

const GITHUB_API = 'https://api.github.com';

function escapeYaml(str) {
  if (!str || !String(str).trim()) return '';
  const s = String(str).trim();
  if (/[:"\n']/.test(s)) return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  return s;
}

async function getFileSha(owner, repo, path, branch, token) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status !== 200) return null;
  const data = await res.json();
  return data.sha || null;
}

async function putFile(owner, repo, path, content, message, branch, token, sha = null) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const base64 = Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(content, 'utf8').toString('base64');
  const body = {
    message,
    content: base64,
    branch,
  };
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub API: ${res.status} ${err}`);
  }
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
    console.error('GITHUB_TOKEN or GITHUB_REPO not set');
    return res.status(500).json({ error: 'Server not configured for saving posts' });
  }

  const [owner, repo] = repoFull.split('/').filter(Boolean);
  if (!owner || !repo) {
    return res.status(500).json({ error: 'Invalid GITHUB_REPO (use owner/repo)' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { title, date, slug, excerpt, content: bodyContent, ig_link: igLink, image: imagePayload } = body;

  if (!title || !date || !slug || !excerpt || bodyContent == null) {
    return res.status(400).json({ error: 'Missing required fields: title, date, slug, excerpt, content' });
  }

  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || 'post';
  const dateStr = String(date).trim().slice(0, 10);
  const postPath = `_posts/${dateStr}-${safeSlug}.md`;

  const imgExt = (imagePayload && imagePayload.extension)
    ? String(imagePayload.extension).replace(/^\./, '').toLowerCase()
    : 'jpg';
  const frontMatter = [
    'layout: post',
    'title: ' + escapeYaml(title),
    'date: ' + dateStr,
  ];
  if (imagePayload && imagePayload.data) {
    frontMatter.push('image: /img/programs/blog_' + safeSlug + '.' + imgExt);
  }
  frontMatter.push('excerpt: ' + escapeYaml(excerpt), 'permalink: /blog/' + safeSlug + '.html');
  if (igLink && String(igLink).trim()) {
    frontMatter.push('ig_link: ' + String(igLink).trim());
  }
  const markdown = '---\n' + frontMatter.join('\n') + '\n---\n\n' + (bodyContent || '').trim() + '\n';

  try {
    const shaPost = await getFileSha(owner, repo, postPath, branch, token);
    await putFile(
      owner,
      repo,
      postPath,
      markdown,
      'Add/update post: ' + title,
      branch,
      token,
      shaPost
    );

    if (imagePayload && imagePayload.data) {
      if (!/^(jpe?g|png|gif|webp)$/.test(imgExt)) {
        return res.status(400).json({ error: 'Image type not allowed (use jpg, png, gif, webp)' });
      }
      const imgPath = `img/programs/blog_${safeSlug}.${imgExt}`;
      let imageBuffer;
      try {
        imageBuffer = Buffer.from(imagePayload.data, 'base64');
      } catch (e) {
        return res.status(400).json({ error: 'Invalid image base64 data' });
      }
      if (imageBuffer.length > 4 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image too large (max 4MB)' });
      }
      const shaImg = await getFileSha(owner, repo, imgPath, branch, token);
      await putFile(
        owner,
        repo,
        imgPath,
        imageBuffer,
        'Add/update image for post: ' + safeSlug,
        branch,
        token,
        shaImg
      );
    }

    return res.status(200).json({
      success: true,
      postPath,
      url: '/blog/' + safeSlug + '.html',
      message: '文章已儲存，將於下次建站後顯示於專業分享。',
    });
  } catch (err) {
    console.error('save-post error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to save post',
    });
  }
}
