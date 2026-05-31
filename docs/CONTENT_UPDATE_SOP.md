# Client Content Update SOP

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
