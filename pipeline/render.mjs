// Step 3. Draw the video one frame at a time from site/render.html and join
// the frames with the narration into a vertical 1080x1920 MP4.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const FPS = 30, TAIL = 2.6;
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const ed = JSON.parse(fs.readFileSync('work/edition.json', 'utf8'));
const pick = ed.pick;
const out = `site/videos/${ed.edition}.mp4`;
fs.mkdirSync('site/videos', { recursive: true });

const voice = ['work/voice.mp3', 'work/voice.wav'].find((f) => fs.existsSync(f) && fs.statSync(f).size > 2000) || null;
const nWords = pick.narration.split(/\s+/).length;
const speech = voice
  ? Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', voice]).toString())
  : nWords / 2.6;
const START = 0.5;                       // narration starts half a second in
const duration = Math.ceil((START + speech + TAIL) * FPS) / FPS;

// Captions: use the voice's own timings when we have them, otherwise spread the words evenly.
const ts = (s) => { const [h, m, r] = s.replace(',', '.').split(':'); return +h * 3600 + +m * 60 + +r; };
let cues = [];
if (voice && fs.existsSync('work/voice.srt')) {
  for (const b of fs.readFileSync('work/voice.srt', 'utf8').split(/\r?\n\r?\n/)) {
    const m = b.match(/(\d+:\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+)\s*\n([\s\S]+)/);
    if (m) cues.push({ s: ts(m[1]), e: ts(m[2]), text: m[3].replace(/\s+/g, ' ').trim() });
  }
}
if (!cues.length) cues = [{ s: 0, e: speech, text: pick.narration }];
const chunks = [];
for (const c of cues) {            // at most 7 words on screen at a time
  const w = c.text.split(' '), parts = Math.ceil(w.length / 7), per = Math.ceil(w.length / parts);
  for (let i = 0; i < parts; i++) {
    chunks.push({ s: START + c.s + (c.e - c.s) * (i * per) / w.length, e: START + c.s + (c.e - c.s) * Math.min(w.length, (i + 1) * per) / w.length, text: w.slice(i * per, (i + 1) * per).join(' ') });
  }
}
chunks.forEach((c, i) => { if (chunks[i + 1]) c.e = Math.max(c.e, chunks[i + 1].s); });

const repo = process.env.GITHUB_REPOSITORY || 'owner/meridian-wire';
const siteUrl = process.env.SITE_URL || `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/`;
const date = new Date(ed.edition + 'T12:00:00Z');
const data = {
  topo: JSON.parse(fs.readFileSync('site/data/countries-50m.json', 'utf8')),
  brand: cfg.brand, label: cfg.videoLabel, headline: pick.headline, countries: pick.countries,
  places: pick.countries.slice(0, 4).map((id) => ed.names[id]).filter(Boolean),
  sources: pick.sources, cues: chunks, duration, siteUrl,
  dateLabel: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).toUpperCase()
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => { console.error('Page error:', e.message); process.exit(1); });
await page.goto(pathToFileURL(path.resolve('site/render.html')).href);
await page.evaluate((d) => window.setup(d), data);

const audioIn = voice ? ['-itsoffset', String(START), '-i', voice] : ['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo'];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', ...audioIn,
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p', '-r', String(FPS),
  '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-af', 'apad', '-t', String(duration), '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exited ' + c)))));
const total = Math.round(duration * FPS);
for (let i = 0; i < total; i++) {
  await page.evaluate((t) => window.seek(t), i / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 93 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % 150 === 0) console.log(`frame ${i}/${total}`);
}
ff.stdin.end(); await done; await browser.close();
fs.writeFileSync('work/video.json', JSON.stringify({ file: out, duration, voiced: !!voice }));
console.log(`Wrote ${out} (${duration.toFixed(1)}s, ${voice ? 'with narration' : 'SILENT: voice step produced no audio'})`);
