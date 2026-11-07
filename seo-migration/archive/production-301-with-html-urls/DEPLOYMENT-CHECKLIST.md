# cstech.ai cutover: 301 redirect deployment checklist

Nothing in this folder is deployed. The live cstech.ai site and its current `.htaccess` are untouched.

## Files

| File | What it is |
|---|---|
| `production.htaccess` | Complete `.htaccess` for the NEW website on cstech.ai: 74 approved 301s + the site's existing `case-studies.html/...` rewrite. |
| `cstech-301-redirects.htaccess` | The 74 approved 301 rules only (same block as above), to paste into an existing `.htaccess`. |
| `cstech-301-pending-manual-review.htaccess` | 51 "Manual Review" rows, all commented out (inactive) until approved. |
| `redirect-test-list.csv` | 74 old URLs with the exact `Location` each must return - for the post-cutover test. |

Rule format: `RewriteRule ^old/path/?$ https://cstech.ai/new/path.html [R=301,L,NC]`
- With or without trailing slash, any letter case; query strings (`utm_*`) are kept.
- One hop: every destination is a final page on https://cstech.ai (no chains, no loops).
- Excluded: Manual Review (51), No Redirect (`/sitemap.xml`), and the homepage `/`.

## Which server

The rules go on the server that serves the **new website on https://cstech.ai after cutover**,
in the `.htaccess` of its document root, **above every other rewrite rule**.

- Not on cst.convomax.online (demo, testing only).
- Not on the old WordPress site before cutover: there the new `.html` paths do not exist yet,
  so redirects would land on 404s.
- `.htaccess` works only on **Apache / LiteSpeed**. The current demo server (Hostinger VPS) runs **nginx**,
  which ignores `.htaccess`. If cstech.ai will be served by that nginx server, these rules must be
  converted to nginx config instead - ask for it before cutover.

## Before cutover

- [ ] Decide the 51 Manual Review rows. Each one is reviewed in
      `Downloads/CS_Tech_301_Mapping_Review_All_URLs.xlsx` and grouped in
      `cstech-301-pending-manual-review.htaccess` (all commented out):
      34 equivalent page, 9 consolidated page, 2 re-activate the page first (vegetation / disaster
      management are noindex today), 6 hold (no equivalent page).
      Approved rows: uncomment the line and move it into the `cstech-301-redirects` block.
      Rows not approved will return 404 on the new site.
      Note: `/mobility` is also a folder in the new site; without its rule, Apache adds a
      slash (`/mobility/`) and then answers 403. Its proposed rule (-> `/mobility/automotive.html`) fixes that.
- [ ] Confirm the production web server type (Apache/LiteSpeed vs nginx) and that `mod_rewrite` and
      `AllowOverride All` (or at least `FileInfo`) are enabled for the document root.
- [ ] Download and keep a backup of the current production `.htaccess` (do not overwrite it blindly).
- [ ] Switch the new site's canonical tags, `og:url`, `sitemap.xml` and `robots.txt` from
      cst.convomax.online to https://cstech.ai.
- [ ] The repo root `.htaccess` still holds the earlier 125-rule block (relative targets, includes
      Manual Review rows). Replace it with `production.htaccess` before uploading the site, so the
      Manual Review rows are not deployed by accident.

## Demo site (cst.convomax.online) until cutover

- Sitemap, robots.txt and canonical/og:url point to the demo domain (keep them that way until cutover).
- `includes/header.html` (shared head) adds `<meta name="robots" content="noindex, nofollow">` on every
  host except `cstech.ai` / `www.cstech.ai`, so the demo is not indexed as a separate site. It switches
  itself off on cstech.ai; nothing to remove at cutover.
- Recommended in addition (works for crawlers that do not run JavaScript), in the demo's nginx
  `server { }` block for cst.convomax.online only:
  `add_header X-Robots-Tag "noindex, nofollow" always;`
  Do not copy this line into the cstech.ai server block at cutover.
- Keep robots.txt `Allow: /` on the demo: crawlers must be able to fetch pages to see the noindex.
- Do not submit the demo sitemap in Google Search Console.

## At cutover

1. Upload the new website to the production document root for cstech.ai.
2. Install `production.htaccess` as `.htaccess` in that root (or paste the
   `cstech-301-redirects` block at the top of the existing one, above `# BEGIN WordPress` / any other rules).
3. Make sure http→https and www→non-www redirects (if any) stay in place; the 301s already point
   straight to `https://cstech.ai/...`.
4. Clear any server / CDN cache.

## After cutover - verification

Run from any machine with bash + curl (expects every row to return 301 to the exact URL, then 200):

```bash
tail -n +2 redirect-test-list.csv | tr -d '\r' | while IFS=, read old want; do
  read code loc < <(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$old")
  final=$(curl -s -o /dev/null -w '%{http_code}' "$want")
  [ "$code" = 301 ] && [ "$loc" = "$want" ] && [ "$final" = 200 ] && echo "OK   $old" || echo "FAIL $old -> $code $loc (dest $final)"
done
```

- [ ] All 74 rows `OK`.
- [ ] Homepage, `/sitemap.xml` and a few new pages return 200 (not 301).
- [ ] Submit the new `https://cstech.ai/sitemap.xml` in Google Search Console; watch Coverage / 404s.

## Rollback

Restore the backed-up `.htaccess`. The 301s stop immediately (browsers may cache 301s, so test in a
private window).
