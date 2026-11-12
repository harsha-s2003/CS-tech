#!/usr/bin/env node
// =====================================================================================
// Builds the 301 redirect blocks of the website's .htaccess from seo-migration/redirects.csv
//
//   node seo-migration/build-redirects.js           check the list and write .htaccess
//   node seo-migration/build-redirects.js --check   only check, change nothing
//
// redirects.csv columns: old_url,new_url,note   (note is optional, for people only)
//   old_url  an address of the OLD website, e.g. https://cstech.ai/geospatial/data-acquisition
//   new_url  the new page on https://cstech.ai, with or without ".html"
//            (https://cstech.ai/services/data-acquisition.html is written as /services/data-acquisition)
//
// The build refuses to write anything if the list has a problem:
//   - an old URL listed twice with different targets
//   - a new page that does not exist in the website folder, or is a noindex page
//   - a redirect to a URL that itself redirects (chain), or that redirects back (loop)
//   - an old URL that is also a real new page, but sent somewhere else (would hide that page)
//   - a URL that is not on cstech.ai
// Only the text between "# BEGIN cstech-301-..." and "# END cstech-301-..." in .htaccess is
// replaced; a copy of the previous .htaccess is kept in seo-migration/backups/.
// No packages needed: plain Node.js.
// =====================================================================================
'use strict';
const fs = require('fs');
const path = require('path');

const TOOLS = __dirname;
const SITE = path.resolve(TOOLS, '..');
const CSV = path.join(TOOLS, 'redirects.csv');
const HTACCESS = path.join(SITE, '.htaccess');
const HOST = 'cstech.ai';
const ORIGIN = 'https://' + HOST;
const CHECK_ONLY = process.argv.includes('--check');
// case-studies filter views are served by case-studies.html (see .htaccess, section 6)
const FILTER_ROUTE = /^case-studies\/(Geospatial|Mobility|Emerging-Tech|Industries|Services|GCC|USA)(\/.*)?$/i;
const BLOCKED = /^(seo-migration|CS-tech_NewPages|\.git|\.claude|\.vscode)(\/|$)/i;

const errors = [], warnings = [];

// ---------- CSV ----------
function parseCsv(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') q = false;
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

// ---------- helpers ----------
const stripSlashes = s => s.replace(/^\/+|\/+$/g, '');
const regexEscape = s => s.replace(/[.+*?()[\]{}|^$\\]/g, '\\$&');
const pageFile = clean => clean === '' ? 'index.html' : clean + '.html';      // 'services/x' -> 'services/x.html'
const isNoindex = file => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(fs.readFileSync(path.join(SITE, file), 'utf8'));

function parseUrl(value, line, what) {
    let u;
    try { u = new URL(value.trim()); } catch (e) { errors.push(`line ${line}: ${what} is not a full URL: "${value}"`); return null; }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== HOST) { errors.push(`line ${line}: ${what} must be on ${HOST}: ${value}`); return null; }
    return u;
}

// new page -> its clean path ('' for the home page) and query
function cleanTarget(u) {
    let p = stripSlashes(decodeURIComponent(u.pathname));
    p = p.replace(/(^|\/)(index|home)\.html$/i, '$1').replace(/\.html$/i, '');
    return { clean: stripSlashes(p), query: u.search };
}

// ---------- read the list ----------
const rows = parseCsv(fs.readFileSync(CSV, 'utf8').replace(/^﻿/, ''));
const list = [];
const byOld = new Map();
rows.forEach((r, i) => {
    const line = i + 1;
    if (i === 0 && /old/i.test(r[0] || '')) return;            // header
    if (!r.join('').trim() || /^\s*#/.test(r[0])) return;       // empty / comment line
    const [oldRaw = '', newRaw = '', note = ''] = r;
    if (!oldRaw.trim() || !newRaw.trim()) { errors.push(`line ${line}: needs both old_url and new_url`); return; }
    const o = parseUrl(oldRaw, line, 'old_url'), n = parseUrl(newRaw, line, 'new_url');
    if (!o || !n) return;
    const oldPath = stripSlashes(decodeURIComponent(o.pathname));
    if (!oldPath) { errors.push(`line ${line}: the home page cannot be redirected (the new home page is served at /)`); return; }
    if (o.search) warnings.push(`line ${line}: the query "${o.search}" of the old URL is ignored (all queries of that path redirect)`);
    if (BLOCKED.test(oldPath)) { errors.push(`line ${line}: ${oldPath} is an internal folder`); return; }
    const t = cleanTarget(n);
    // the destination must be a real, indexable page of the new site
    if (FILTER_ROUTE.test(t.clean)) {
        if (!fs.existsSync(path.join(SITE, 'case-studies.html'))) errors.push(`line ${line}: case-studies.html is missing`);
    } else if (!fs.existsSync(path.join(SITE, pageFile(t.clean)))) {
        errors.push(`line ${line}: new page does not exist in the website folder: ${ORIGIN}/${t.clean} (file ${pageFile(t.clean)})`); return;
    } else if (isNoindex(pageFile(t.clean))) {
        errors.push(`line ${line}: new page is marked noindex, Google would drop it: ${ORIGIN}/${t.clean}`); return;
    }
    const key = oldPath.toLowerCase();
    const entry = { line, oldRaw: oldRaw.trim(), oldPath, key, clean: t.clean, query: t.query, note };
    if (byOld.has(key)) {
        const prev = byOld.get(key);
        if (prev.clean !== entry.clean || prev.query !== entry.query) errors.push(`line ${line}: /${oldPath} is already on line ${prev.line} with a DIFFERENT target (${ORIGIN}/${prev.clean}${prev.query} vs ${ORIGIN}/${entry.clean}${entry.query})`);
        else warnings.push(`line ${line}: duplicate of line ${prev.line} (same target), ignored`);
        return;
    }
    byOld.set(key, entry); list.push(entry);
});

// ---------- cross checks: chains, loops, hidden pages ----------
for (const e of list) {
    e.samePage = e.key === e.clean.toLowerCase() && !e.query;      // e.g. old /about/ -> new /about
    const next = byOld.get(e.clean.toLowerCase());
    if (next && !e.samePage && !(next.samePage)) {
        errors.push(`line ${e.line}: chain - /${e.oldPath} -> /${e.clean}, but /${e.clean} is itself an old URL (line ${next.line}) -> /${next.clean}. Point line ${e.line} to the final page.`);
    }
    // an old URL that is ALSO a real new page must point to that page, or the page becomes unreachable
    if (!e.samePage && fs.existsSync(path.join(SITE, e.oldPath + '.html')) && e.key !== e.clean.toLowerCase()) {
        errors.push(`line ${e.line}: /${e.oldPath} is a real page of the new site, but this line sends it to /${e.clean}`);
    }
}

// ---------- safety net: old section roots ----------
// A section root is an old URL that other old URLs sit under (e.g. /resources/case-studies).
// Unknown URLs below it go where the section root goes. Deepest sections first.
const roots = list.filter(r => list.some(o => o !== r && o.key.startsWith(r.key + '/')))
    .sort((a, b) => b.key.split('/').length - a.key.split('/').length || a.key.localeCompare(b.key));

// ---------- render ----------
const target = e => ORIGIN + '/' + e.clean + e.query;
const redirectLines = [];
for (const e of [...list].sort((a, b) => a.key.localeCompare(b.key))) {
    if (e.note) redirectLines.push(`    # ${e.note.replace(/\s+/g, ' ')}`);
    if (e.samePage) {
        // the new page has the same address: redirect only the variants (/about/, /ABOUT), never /about itself
        redirectLines.push(`    RewriteCond %{REQUEST_URI} !^/${regexEscape(e.clean)}$`);
    }
    redirectLines.push(`    RewriteRule ^${regexEscape(e.oldPath)}/?$ ${target(e)} [R=301,L,NC${e.query ? ',QSA' : ''}]`);
}
const netLines = [];
for (const r of roots) {
    netLines.push(`    # unknown /${r.oldPath}/... -> ${target(r)}`);
    netLines.push('    RewriteCond %{ENV:REDIRECT_STATUS} ^$');
    netLines.push('    RewriteCond %{REQUEST_FILENAME} !-f');
    netLines.push('    RewriteCond %{REQUEST_FILENAME} ^(.+?)/*$');
    netLines.push('    RewriteCond %1.html !-f');
    netLines.push(`    RewriteRule ^${regexEscape(r.oldPath)}/. ${target(r)} [R=301,L,NC${r.query ? ',QSA' : ''}]`);
}

// ---------- report ----------
console.log(`redirects.csv: ${list.length} old URLs -> ${new Set(list.map(target)).size} new pages; ${list.filter(e => e.samePage).length} keep the same address (only their variants redirect); safety net: ${roots.length} old sections`);
warnings.forEach(w => console.log('  warning: ' + w));
if (errors.length) {
    console.log(`\n${errors.length} PROBLEM(S) - nothing was written:`);
    errors.forEach(e => console.log('  - ' + e));
    process.exit(1);
}
if (CHECK_ONLY) { console.log('check passed (--check: .htaccess not changed)'); process.exit(0); }

// ---------- write .htaccess (only the generated blocks) ----------
const before = fs.readFileSync(HTACCESS, 'utf8');
const eol = before.includes('\r\n') ? '\r\n' : '\n';
function replaceBlock(text, name, lines) {
    const re = new RegExp(`([ \\t]*# BEGIN ${name}\\r?\\n)[\\s\\S]*?([ \\t]*# END ${name})`);
    if (!re.test(text)) { console.log(`.htaccess has no "# BEGIN ${name}" / "# END ${name}" markers - nothing written`); process.exit(1); }
    const stamp = `    # generated ${new Date().toISOString().slice(0, 10)} from seo-migration/redirects.csv - do not edit by hand`;
    return text.replace(re, (m, a, b) => a + [stamp, ...lines].join(eol) + eol + b);
}
let after = replaceBlock(before, 'cstech-301-redirects', redirectLines);
after = replaceBlock(after, 'cstech-301-safety-net', netLines);
if (after === before) { console.log('.htaccess already up to date'); process.exit(0); }
const backups = path.join(TOOLS, 'backups');
fs.mkdirSync(backups, { recursive: true });
const copy = path.join(backups, 'htaccess-' + new Date().toISOString().replace(/[:.]/g, '-') + '.txt');
fs.writeFileSync(copy, before);
fs.writeFileSync(HTACCESS, after.replace(/\r?\n/g, eol));
console.log(`.htaccess updated (previous version: seo-migration/backups/${path.basename(copy)})`);
console.log('next: node seo-migration/test-redirects.js');
