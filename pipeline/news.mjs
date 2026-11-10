// Step 1. Pull headlines from every feed in config.json, group the ones about
// the same event, and rank events by how many different outlets carry them.
import fs from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { loadGazetteer } from './gazetteer.mjs';

const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const MAX_AGE_H = 30;

const STOP = new Set(('the a an and or but of in on at to for from by with as is are was were be been has have had it its this that these those ' +
  'after before over under amid amidst into out up down off about against between during new says say said will would could may might can ' +
  'not no more most than then they their them he she his her who what when where why how you your we our us live latest update updates news ' +
  'video watch report reports year years day days week weeks first one two three').split(' '));

const text = (v) => (v == null ? '' : typeof v === 'object' ? text(v['#text'] ?? v['@_href'] ?? '') : String(v));
const strip = (s) => text(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;|&rsquo;/g, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();

export function tokens(title) {
  const out = new Set();
  for (let w of title.toLowerCase().replace(/[’']s\b/g, '').split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 3 || STOP.has(w)) continue;
    if (w.length > 4 && w.endsWith('s')) w = w.slice(0, -1);
    out.add(w);
  }
  return out;
}
export function similar(a, b) {
  let n = 0; for (const t of a) if (b.has(t)) n++;
  const min = Math.min(a.size, b.size);
  return min >= 2 && n >= 3 && n / min >= 0.5 || (min <= 4 && n >= 2 && n / min >= 0.6);
}

export function parseFeed(xml, outlet) {
  const doc = new XMLParser({ ignoreAttributes: false, processEntities: true, htmlEntities: true }).parse(xml);
  const raw = doc?.rss?.channel?.item ?? doc?.['rdf:RDF']?.item ?? doc?.feed?.entry ?? [];
  const items = [];
  for (const it of [].concat(raw)) {
    const title = strip(it.title);
    let link = it.link;
    if (Array.isArray(link)) link = link.find((l) => l?.['@_rel'] !== 'self') ?? link[0];
    link = text(link).trim() || text(it.guid).trim();
    const when = Date.parse(text(it.pubDate ?? it['dc:date'] ?? it.published ?? it.updated));
    if (!title || !/^https:\/\//.test(link)) continue;
    items.push({ outlet, title, link, desc: strip(it.description ?? it.summary ?? '').slice(0, 600), time: Number.isNaN(when) ? null : when });
  }
  return items;
}

export function cluster(items, now) {
  const fresh = items.filter((i) => i.time == null || (now - i.time < MAX_AGE_H * 3600e3 && i.time - now < 3600e3));
  const groups = [];
  for (const it of fresh) {
    it.tok = tokens(it.title);
    if (it.tok.size < 2) continue;
    const g = groups.find((g) => g.items.some((o) => similar(o.tok, it.tok)));
    if (g) g.items.push(it); else groups.push({ items: [it] });
  }
  for (const g of groups) {
    g.outlets = [...new Set(g.items.map((i) => i.outlet))];
    g.latest = Math.max(...g.items.map((i) => i.time ?? 0));
    g.score = g.outlets.length * 10 + Math.min(g.items.length, 9) + (g.latest ? Math.max(0, 1 - (now - g.latest) / (MAX_AGE_H * 3600e3)) : 0);
  }
  return groups.sort((a, b) => b.score - a.score);
}

async function main() {
  const now = Date.now();
  const results = await Promise.all(cfg.feeds.map(async (f) => {
    try {
      const r = await fetch(f.url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; MeridianWire/1.0)', accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const items = parseFeed(await r.text(), f.name);
      console.log(`ok    ${f.name}: ${items.length} headlines`);
      return items;
    } catch (e) { console.log(`FAIL  ${f.name}: ${e.message}`); return []; }
  }));
  const working = results.filter((r) => r.length).length;
  if (working < 3) throw new Error(`Only ${working} feeds answered; refusing to publish a thin edition.`);

  const gaz = loadGazetteer('site/data/countries-50m.json');
  const order = cfg.feeds.map((f) => f.name);
  const stories = cluster(results.flat(), now).slice(0, cfg.storiesPerEdition).map((g) => {
    const perOutlet = g.outlets.map((o) => g.items.find((i) => i.outlet === o)).sort((a, b) => order.indexOf(a.outlet) - order.indexOf(b.outlet));
    const lead = perOutlet[0];
    return {
      title: lead.title,
      snippets: perOutlet.slice(0, 5).map((i) => ({ outlet: i.outlet, title: i.title, text: i.desc })),
      countries: gaz.tag(g.items.map((i) => i.title).join(' . ') + ' . ' + perOutlet.map((i) => i.desc).join(' . ')),
      sources: perOutlet.slice(0, 4).map((i) => ({ name: i.outlet, url: i.link })),
      outlets: g.outlets.length,
      tokens: [...lead.tok]
    };
  });
  const names = {};
  stories.forEach((s) => s.countries.forEach((id) => { names[id] = gaz.names[id]; }));
  fs.mkdirSync('work', { recursive: true });
  fs.writeFileSync('work/stories.json', JSON.stringify({ edition: new Date(now).toISOString().slice(0, 10), generated: new Date(now).toISOString(), feedsWorking: working, names, stories }, null, 1));
  console.log(`\n${stories.length} stories. Top: "${stories[0].title}" (${stories[0].outlets} outlets)`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
