// Step 4. Publish the edition to the site: write site/data/latest.json and keep
// the last few days' videos by copying them over from the live site.
import fs from 'node:fs';
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const ed = JSON.parse(fs.readFileSync('work/edition.json', 'utf8'));
const hasVideo = fs.existsSync('work/video.json');
const repo = process.env.GITHUB_REPOSITORY || '';
const siteUrl = process.env.SITE_URL || (repo ? `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/` : '');

let videos = [];
if (siteUrl) {
  try {
    const r = await fetch(siteUrl + 'data/latest.json', { signal: AbortSignal.timeout(20000) });
    if (r.ok) videos = ((await r.json()).videos || []).filter((v) => v.edition !== ed.edition && /^videos\/[\w.-]+\.mp4$/.test(v.file));
  } catch {}
}
const kept = [];
for (const v of videos.slice(0, cfg.videosKeptOnSite - 1)) {
  try {
    const r = await fetch(siteUrl + v.file, { signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    fs.mkdirSync('site/videos', { recursive: true });
    fs.writeFileSync('site/' + v.file, Buffer.from(await r.arrayBuffer()));
    kept.push(v);
  } catch (e) { console.log(`Could not carry over ${v.file}: ${e.message}`); }
}
const today = hasVideo ? { edition: ed.edition, file: `videos/${ed.edition}.mp4`, title: ed.pick.headline } : null;
const out = {
  edition: ed.edition, generated: ed.generated, names: ed.names, stories: ed.stories,
  video: today ? { ...today, storyId: ed.pick.storyId, tokens: ed.pick.tokens } : null,
  videos: [today, ...kept].filter(Boolean)
};
fs.writeFileSync('site/data/latest.json', JSON.stringify(out, null, 1) + '\n');
console.log(`Edition ${ed.edition}: ${out.stories.length} stories, ${out.videos.length} video(s) on the site.`);
