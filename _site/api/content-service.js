const GITHUB_API = 'https://api.github.com';
const TESTIMONIALS_PATH = '_data/testimonials.yml';
const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/duofitness.health?igsh=dWwzemIxcTM1NXc0';

function encodeGitHubPath(filePath) {
  return String(filePath).split('/').map(encodeURIComponent).join('/');
}

function getAllowedEmails() {
  return (process.env.EDITOR_ALLOWED_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export async function verifyEditorAccess(req) {
  const token = getBearerToken(req);
  const allowedEmails = getAllowedEmails();

  if (process.env.EDITOR_DEV_TOKEN && token === process.env.EDITOR_DEV_TOKEN) {
    return { ok: true, email: 'local-dev-editor', provider: 'dev-token' };
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    return {
      ok: false,
      status: 500,
      error: 'Content editor auth is not configured. Add GOOGLE_CLIENT_ID in Vercel.',
    };
  }

  if (!allowedEmails.length) {
    return {
      ok: false,
      status: 500,
      error: 'No editor emails are configured. Add EDITOR_ALLOWED_EMAILS in Vercel.',
    };
  }

  if (!token) {
    return { ok: false, status: 401, error: 'Please sign in with Google before saving.' };
  }

  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token);
  const response = await fetch(url);
  if (!response.ok) {
    return { ok: false, status: 401, error: 'Google sign-in token could not be verified.' };
  }

  const profile = await response.json();
  const email = String(profile.email || '').toLowerCase();
  const emailVerified = String(profile.email_verified) === 'true' || profile.email_verified === true;

  if (profile.aud !== process.env.GOOGLE_CLIENT_ID) {
    return { ok: false, status: 401, error: 'Google sign-in token was issued for a different app.' };
  }

  if (!email || !emailVerified) {
    return { ok: false, status: 403, error: 'Please use a Google account with a verified email.' };
  }

  if (!allowedEmails.includes(email)) {
    return { ok: false, status: 403, error: 'This email is not on the editor allowlist: ' + email };
  }

  return { ok: true, email, provider: 'google' };
}

export function escapeYamlValue(str) {
  if (str == null) return '';
  const s = String(str).trim();
  if (!s) return '';
  if (/[:"#[\]{}|>*]/.test(s) || s.includes("'")) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  return s;
}

function contentBlock(str) {
  if (str == null) return '';
  const s = String(str).trim();
  if (!s) return '';
  if (/\n/.test(s)) {
    return '|\n' + s.split(/\r?\n/).map(line => '  ' + line).join('\n');
  }
  return escapeYamlValue(s);
}

async function getFile(owner, repo, path, branch, token) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' },
  });
  if (res.status !== 200) return { sha: null, content: null };
  const data = await res.json();
  const content = data.content ? Buffer.from(data.content, 'base64').toString('utf8') : null;
  return { sha: data.sha, content };
}

async function putFile(owner, repo, path, content, message, branch, token, sha = null) {
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeGitHubPath(path)}`;
  const base64 = Buffer.isBuffer(content)
    ? content.toString('base64')
    : Buffer.from(content, 'utf8').toString('base64');
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

function getRepoConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repoFull) {
    const missing = [];
    if (!token) missing.push('GITHUB_TOKEN');
    if (!repoFull) missing.push('GITHUB_REPO');
    throw new Error('Server not configured for content saving. Add ' + missing.join(' and ') + ' in Vercel.');
  }

  const [owner, repo] = repoFull.split('/').filter(Boolean);
  if (!owner || !repo) throw new Error('Invalid GITHUB_REPO (use owner/repo)');
  return { token, owner, repo, branch };
}

function validateImage(imagePayload) {
  if (!imagePayload || !imagePayload.data) return null;
  const extension = String(imagePayload.extension || 'jpg').replace(/^\./, '').toLowerCase();
  if (!/^(jpe?g|png|gif|webp)$/.test(extension)) {
    const err = new Error('Image type not allowed (use jpg, png, gif, webp)');
    err.status = 400;
    throw err;
  }
  const buffer = Buffer.from(imagePayload.data, 'base64');
  if (buffer.length > 4 * 1024 * 1024) {
    const err = new Error('Image too large (max 4MB)');
    err.status = 400;
    throw err;
  }
  return { extension, buffer };
}

export async function savePost(body, editorEmail = 'editor') {
  const { token, owner, repo, branch } = getRepoConfig();
  const { title, date, slug, excerpt, content: bodyContent, ig_link: igLink, image: imagePayload } = body || {};

  if (!title || !date || !slug || !excerpt || bodyContent == null) {
    const err = new Error('Missing required fields: title, date, slug, excerpt, content');
    err.status = 400;
    throw err;
  }

  const safeSlug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || 'post';
  const dateStr = String(date).trim().slice(0, 10);
  const postPath = `_posts/${dateStr}-${safeSlug}.md`;
  const image = validateImage(imagePayload);

  const frontMatter = [
    'layout: post',
    'title: ' + escapeYamlValue(title),
    'date: ' + dateStr,
  ];
  if (image) frontMatter.push('image: /img/programs/blog_' + safeSlug + '.' + image.extension);
  frontMatter.push('excerpt: ' + escapeYamlValue(excerpt), 'permalink: /blog/' + safeSlug + '.html');
  if (igLink && String(igLink).trim()) frontMatter.push('ig_link: ' + String(igLink).trim());

  const markdown = '---\n' + frontMatter.join('\n') + '\n---\n\n' + (bodyContent || '').trim() + '\n';
  const { sha: postSha } = await getFile(owner, repo, postPath, branch, token);
  await putFile(owner, repo, postPath, markdown, `Content editor (${editorEmail}): save post ${safeSlug}`, branch, token, postSha);

  if (image) {
    const imgPath = `img/programs/blog_${safeSlug}.${image.extension}`;
    const { sha: imageSha } = await getFile(owner, repo, imgPath, branch, token);
    await putFile(owner, repo, imgPath, image.buffer, `Content editor (${editorEmail}): save post image ${safeSlug}`, branch, token, imageSha);
  }

  return {
    success: true,
    type: 'post',
    postPath,
    url: '/blog/' + safeSlug + '.html',
    message: '文章已儲存，將於下次建站後顯示於專業分享。',
  };
}

export async function saveTestimonial(body, editorEmail = 'editor') {
  const { token, owner, repo, branch } = getRepoConfig();
  const { name, category, content, instagram, image: imagePayload } = body || {};

  if (!name || !category || content == null) {
    const err = new Error('Missing required fields: name, category, content');
    err.status = 400;
    throw err;
  }

  const slug = String(name).replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\u4e00-\u9fff-]/g, '').slice(0, 30) || 'testimonial';
  const image = validateImage(imagePayload);
  const imagePath = image ? `/img/testimonials/${slug}.${image.extension}` : '/img/testimonials/default.jpg';

  const { sha: yamlSha, content: existingYaml } = await getFile(owner, repo, TESTIMONIALS_PATH, branch, token);
  const newEntry = [
    '',
    '- name: ' + escapeYamlValue(name),
    '  image: ' + imagePath,
    '  category: ' + escapeYamlValue(category),
    '  content: ' + contentBlock(content),
    '  instagram: ' + (instagram && String(instagram).trim() ? escapeYamlValue(instagram) : DEFAULT_INSTAGRAM_URL),
  ].join('\n');
  const newYaml = (existingYaml || '').trimEnd() + newEntry + '\n';

  await putFile(owner, repo, TESTIMONIALS_PATH, newYaml, `Content editor (${editorEmail}): add testimonial ${name}`, branch, token, yamlSha);

  if (image) {
    const imgPath = `img/testimonials/${slug}.${image.extension}`;
    const { sha: imageSha } = await getFile(owner, repo, imgPath, branch, token);
    await putFile(owner, repo, imgPath, image.buffer, `Content editor (${editorEmail}): save testimonial image ${slug}`, branch, token, imageSha);
  }

  return {
    success: true,
    type: 'testimonial',
    message: '成功案例已儲存，將於下次建站後顯示於成功案例。',
  };
}
