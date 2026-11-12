# cstech.ai redirects: how they work and how to manage them

The new website replaces the old one on **https://cstech.ai**. Every old URL sends visitors
and Google to its new page with a **permanent 301 redirect, in one hop**, so rankings move
to the new pages. New pages have **clean URLs without ".html"** (`https://cstech.ai/about`).

## The pieces

| File | What it is |
|---|---|
| `.htaccess` (website root) | Everything the server does: redirects, clean URLs, https, 404 page. Uploaded with the site. |
| `seo-migration/redirects.csv` | **The master list**: one old URL and its new URL per row. Edit this. |
| `seo-migration/build-redirects.js` | Checks the list and writes it into `.htaccess`. |
| `seo-migration/test-redirects.js` | Tests every redirect, page and link (locally or on the live site). |
| `seo-migration/local-apache/httpd.conf` | A local copy of the live server (XAMPP's Apache) for testing. |
| `404.html` | The custom "Page not found" page, shown for every unknown URL. |

`seo-migration/` is for you only: **do not upload it**. (If it is uploaded by mistake, the
server answers 404 for it anyway.)

## Add or change a redirect

1. Open `seo-migration/redirects.csv` in Excel (or any text editor) and add or edit a row:

   | old_url | new_url | note |
   |---|---|---|
   | `https://cstech.ai/old/page` | `https://cstech.ai/services/data-acquisition` | optional |

   - `old_url`: an address of the old website. With or without a trailing slash, any case.
   - `new_url`: the new page. Writing it with `.html` is fine; it is converted to the clean URL.
   - Save as **CSV** (comma separated).
2. Build: in a terminal in the website folder

   ```
   node seo-migration/build-redirects.js
   ```

   It refuses to write anything, and tells you the row, if the list has a mistake: an old URL
   listed twice with different targets, a new page that does not exist or is noindex,
   a redirect chain or loop, a URL that is not on cstech.ai, or an old URL that is also a real
   new page. A copy of the previous `.htaccess` is kept in `seo-migration/backups/`.
3. Test locally (start the local server first, see below):

   ```
   node seo-migration/test-redirects.js
   ```

4. Upload **only `.htaccess`** to the website root on the server, then test the live site:

   ```
   node seo-migration/test-redirects.js --live
   ```

Only the two generated blocks in `.htaccess` (`# BEGIN cstech-301-...` / `# END ...`) are
rewritten by the build; everything else in that file can be edited by hand.

## What every rule does

```apache
RewriteRule ^geospatial/data-acquisition/?$ https://cstech.ai/services/data-acquisition [R=301,L,NC]
```

- `/geospatial/data-acquisition`, `/geospatial/data-acquisition/`, `/GEOSPATIAL/Data-Acquisition`
  all redirect; query strings such as `?utm_source=...` are kept.
- `http://`, `www.` and old URLs all go straight to the final `https://cstech.ai/...` page (one hop).
- **Safety net:** an old URL that is not in the list, under an old section (`/resources/case-studies/...`,
  `/resources/news-and-publications/...`, `/resources/blogs/...`, `/resources/...`, `/geospatial/...`,
  `/geospatialamericas/...`, `/infra-utilities/...`, `/mobility/...`) goes to the page that section's own
  URL goes to (never the home page). Real new pages are never caught by it.
- `/about.html` -> `/about`, `/about/` -> `/about`, `/index.html` and `/home` -> `/`.
- Anything else that does not exist: the custom 404 page with status 404.

## Local testing server

```
F:\xampp\apache\bin\httpd.exe -f "F:\cs\CS-tech_NewPages\seo-migration\local-apache\httpd.conf"
```

Open http://localhost:8080/ . Stop it with Ctrl+C in that window.
(VS Code Live Server cannot serve clean URLs, so links without ".html" do not work there; use this
server instead.)

## Upload checklist (cutover)

**Before deleting anything on the server**
- [ ] Download a full backup of the old website (all files) from the hosting panel.
- [ ] Download the server's current `.htaccess` and look for anything that is not about the old
      website (for example a `# php -- BEGIN cPanel-generated handler` block). Keep such blocks:
      paste them at the end of the new `.htaccess`.
- [ ] Do not delete `.well-known/` (SSL certificate renewal), `cgi-bin/` or folders of other domains.

**Files that stay on the server as they are (do not delete them)**
The new pages link to these at the same addresses, so they simply stay where they are:
- [ ] `/uploads/` - all investor documents (PDFs, MP3s).
- [ ] `/privacy-policy.pdf` - linked from the footer.
- [ ] `/img/social-share.jpg` - the share image of the Investors page. The new site also has an
      `img/` folder: upload it so it merges with the server's `img/` (do not delete the server's
      `img/` folder first).
- [ ] The old `sitemap.xml` and `.htaccess` are **replaced** by the new ones from this folder.

**Upload** everything in the website folder except: `.git/`, `.claude/`, `seo-migration/`,
`.gitignore`, and any `.zip` file.

**Right after upload**
- [ ] `node seo-migration/test-redirects.js --live` -> `RESULT: ALL PASSED`.
- [ ] If every page shows "500 Internal Server Error": the host does not allow the
      `DirectorySlash Off` line. Ask the host to enable `AllowOverride All` for the site. Do not
      just delete that line: `/news`, `/blogs` and `/case-studies` would then loop.
- [ ] Google Search Console: submit `https://cstech.ai/sitemap.xml`; inspect a few old and new URLs.
- [ ] For the next 2-4 weeks, check Search Console > Pages > "Not found (404)". Add any old URL that
      appears to `redirects.csv`, build, test, upload `.htaccess`.
- [ ] Keep the redirects permanently (at least one year).

## Things found during the migration

- 9 investor-document links were already broken on the old website (wrong or missing file names),
  e.g. `/uploads/.pdf` and `/uploads/Change-in-Management.pdfIntimation-of-reconstitution-...pdf`.
  They need the correct files from the company secretary.
- `/offerings.htm` and `/solutions.htm` on the old site already lead to a 404; they are not redirected.
- Two rows were added to your sheet: `/resources/awards-and-project-wins/` (a live old page linked
  from the old home page) -> `/news`, and an old dead-link variant of the Digital BIW case study.

## The demo server (cst.convomax.online, nginx)

nginx ignores `.htaccess`. If this version is uploaded to the demo, clean URLs need this in the
demo's nginx `server { }` block (ask the server admin):

```nginx
error_page 404 /404.html;
location ~* ^/case-studies/(Geospatial|Mobility|Emerging-Tech|Industries|Services|GCC|USA)(/[^.]*)?$ {
    try_files /case-studies.html =404;
}
location / {
    try_files $uri $uri.html =404;
}
```

Keep the demo's `X-Robots-Tag: noindex, nofollow` header there; never copy it to cstech.ai.
