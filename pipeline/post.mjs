// Step 5. Hand the video to Postiz, which publishes it to the accounts you
// connected there. Skipped until the POSTIZ_API_KEY secret exists.
// config.json "postMode": "draft" leaves each post in Postiz for you to approve;
// "now" publishes immediately.
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const key = process.env.POSTIZ_API_KEY;
if (!key) { console.log('No POSTIZ_API_KEY secret yet, so nothing was posted. See README.'); process.exit(0); }
if (!fs.existsSync('work/video.json')) { console.error('No video was rendered today; nothing to post.'); process.exit(1); }

const API = (process.env.POSTIZ_API_URL || 'https://api.postiz.com/public/v1').replace(/\/$/, '');
const ed = JSON.parse(fs.readFileSync('work/edition.json', 'utf8'));
const { file } = JSON.parse(fs.readFileSync('work/video.json', 'utf8'));
const pick = ed.pick;
const repo = process.env.GITHUB_REPOSITORY || '';
const siteUrl = process.env.SITE_URL || (repo ? `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/` : '');

async function call(path, init = {}) {
  const r = await fetch(API + path, { ...init, headers: { Authorization: key, ...(init.headers || {}) }, signal: AbortSignal.timeout(300000) });
  const body = await r.text();
  if (!r.ok) throw new Error(`Postiz ${path} answered ${r.status}: ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : null;
}

const places = pick.countries.map((id) => ed.names[id]).filter(Boolean);
const tags = [...cfg.hashtags, ...places.slice(0, 2).map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))];
const hash = tags.map((t) => '#' + t).join(' ');
const source = 'Source: ' + pick.sources.join(', ');
const long = `${pick.caption}\n\n${source}\nEvery story on the globe: ${siteUrl}\n\n${hash}`;
let short = `${pick.caption}\n\n${source}\n${siteUrl}`;
if (short.length > 280) short = `${pick.headline}\n\n${source}\n${siteUrl}`.slice(0, 280);

const SETTINGS = {
  x: () => ({ content: short, settings: { __type: 'x', who_can_reply_post: 'everyone' } }),
  tiktok: () => ({ content: long, settings: { __type: 'tiktok', privacy_level: 'PUBLIC_TO_EVERYONE', duet: false, stitch: false, comment: true, autoAddMusic: 'no',
    brand_content_toggle: false, brand_organic_toggle: false, video_made_with_ai: !!cfg.markAsAiGenerated, content_posting_method: 'DIRECT_POST' } }),
  youtube: () => ({ content: `${pick.narration}\n\n${source}\n${siteUrl}\n\n${hash} #Shorts`, settings: { __type: 'youtube', title: pick.headline.slice(0, 95), type: 'public',
    selfDeclaredMadeForKids: 'no', tags: tags.map((t) => ({ value: t, label: t })) } }),
  instagram: () => ({ content: long, settings: { __type: 'instagram', post_type: 'post', is_trial_reel: false, collaborators: [] } }),
  'instagram-standalone': () => ({ content: long, settings: { __type: 'instagram-standalone', post_type: 'post', is_trial_reel: false, collaborators: [] } })
};

const channels = (await call('/integrations')).filter((i) => !i.disabled && SETTINGS[i.identifier]);
if (!channels.length) { console.error('Postiz has no connected X, TikTok, YouTube or Instagram account.'); process.exit(1); }
console.log('Channels: ' + channels.map((c) => `${c.identifier} (${c.name})`).join(', '));

const form = new FormData();
form.append('file', new Blob([fs.readFileSync(file)], { type: 'video/mp4' }), `${ed.edition}.mp4`);
const media = await call('/upload', { method: 'POST', body: form });

const res = await call('/posts', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    type: cfg.postMode === 'now' ? 'now' : 'draft', date: new Date().toISOString(), shortLink: false, tags: [],
    posts: channels.map((c) => { const s = SETTINGS[c.identifier](); return { integration: { id: c.id }, value: [{ content: s.content, image: [{ id: media.id, path: media.path }] }], settings: s.settings }; })
  })
});
console.log(cfg.postMode === 'now' ? 'Published.' : 'Saved as drafts in Postiz, waiting for your approval.', JSON.stringify(res));
