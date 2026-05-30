# Client Content Update SOP

## Access Setup

1. In Google Cloud, create an OAuth 2.0 Web Client ID for this website domain.
2. In Vercel project settings, add these environment variables:
   - `GOOGLE_CLIENT_ID`: Google OAuth Web Client ID.
   - `EDITOR_ALLOWED_EMAILS`: comma-separated verified Google emails allowed to edit content.
   - `GITHUB_TOKEN`: GitHub token with repo content write access.
   - `GITHUB_REPO`: target repo in `owner/repo` format.
   - `GITHUB_BRANCH`: target branch, usually `main`.
3. Redeploy the site after changing environment variables.

## Client Workflow

1. Open `/content-editor.html`.
2. Click the Google sign-in button.
3. Sign in with the approved Gmail or Google Workspace email.
4. Choose a tab:
   - `專業分享文章`: add or update a blog post.
   - `成功案例`: add a testimonial.
5. Fill all required fields.
6. Upload an image if needed. Images must be JPG, PNG, GIF, or WebP and under 4MB.
7. Click save.
8. Wait for Vercel to rebuild the site. The update appears after the deployment finishes.

## Blog Post Rules

- `網址代稱` should be lowercase English, numbers, and hyphens only.
- The post body supports Markdown, including `## headings`, `**bold text**`, and lists.
- Optional Instagram links show as an Instagram link on the article/listing.

## Testimonial Rules

- `客戶名稱`, `類別`, and `見證內容` are required.
- If no image is uploaded, the default testimonial image is used.
- If no Instagram URL is entered, the brand default Instagram URL is used.

## Troubleshooting

- `Google 登入尚未設定`: add `GOOGLE_CLIENT_ID` in Vercel and redeploy.
- `This email is not on the editor allowlist`: add the client's verified Google email to `EDITOR_ALLOWED_EMAILS`.
- `Server not configured for content saving`: confirm `GITHUB_TOKEN` and `GITHUB_REPO` are set.
- Content saved but not visible yet: wait for Vercel deployment, then refresh the page.
