# Brand Variables

Most reusable client-specific values live in `_data/brand.yml`.

## Core Variables

- `name`: public brand name.
- `nav_name`: text shown beside the logo in the navigation bar.
- `tagline`: short service promise.
- `description`: reusable footer/about description.
- `copyright_year`: footer year.

## Logo Variables

- `logo.nav`: logo used in the navigation bar.
- `logo.header`: logo used in page header/hero sections.
- `logo.yellow`: yellow logo asset.
- `logo.white`: white logo asset.

## Social And Contact Variables

- `social.line.label`
- `social.line.url`
- `social.instagram.label`
- `social.instagram.url`
- `social.email.label`
- `social.email.address`
- `social.address.url`

## CTA Variables

- `cta.booking_label`
- `cta.booking_url`

## Content Editor Variables

- `content_editor.url`: direct admin/editor URL.
- `content_editor.google_client_id_env`: Vercel env var expected by `/api/auth-config`.
- `content_editor.allowed_emails_env`: Vercel env var used by `/api/content`.

## Developer Notes

- Prefer reading values with `{% assign brand = site.data.brand %}`.
- Use `{{ brand.name }}`, `{{ brand.logo.header | relative_url }}`, and `{{ brand.social.instagram.url }}` instead of hard-coded brand strings.
- Page front matter titles are still plain text because Jekyll front matter is not evaluated as Liquid by default.
- `_site/` is generated output. Edit source files, then rebuild with:

```sh
/opt/homebrew/bin/rbenv exec bundle exec jekyll build
```
