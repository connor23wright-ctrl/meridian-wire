# Meridian Wire

A world-news globe that updates itself once a day and makes one short vertical video about the day's top story.

- **Site:** https://connor23wright-ctrl.github.io/meridian-wire/
- **Runs:** every day at 13:17 UTC (about 5:17 am Pacific), or any time from the Actions tab.

## What happens each day

1. **Gather.** Headlines are pulled from the outlets listed in `config.json`. Headlines about the same event are grouped, and events are ranked by how many different outlets carry them.
2. **Write.** Each story gets a short neutral summary, and the top story that can be placed on the map gets a headline and a 25-second narration. Every story keeps links to the outlets that reported it.
3. **Voice.** The narration is read by a synthetic voice.
4. **Render.** The video (1080 x 1920, vertical) is drawn frame by frame: the globe turns to the countries involved and lights them up.
5. **Publish.** The site gets the new stories and the new video. The last 7 videos stay on the site.
6. **Post.** If posting is set up, the video goes to your TikTok, YouTube, Instagram and X accounts through Postiz.

## One-time setup (all in the browser)

**Turn on the site**

1. In this repository open **Settings**, then **Pages**.
2. Under "Build and deployment", set **Source** to **GitHub Actions**.

**Run it the first time**

1. Open the **Actions** tab. If asked, click the button to enable workflows.
2. Click **Daily edition** on the left, then **Run workflow**, then the green **Run workflow** button.
3. It takes roughly 10 to 15 minutes. A green tick means the site is updated.

**Turn on posting**

1. Create a Postiz account and connect your TikTok, YouTube, Instagram and X accounts inside it.
2. Copy your Postiz API key from its settings.
3. In this repository open **Settings**, then **Secrets and variables**, then **Actions**, then **New repository secret**. Name it `POSTIZ_API_KEY` and paste the key.

Until that secret exists, the daily run skips posting and everything else still works.

## Approving posts

`config.json` starts with `"postMode": "draft"`. Each day's posts are saved in Postiz as drafts and you publish them there. When you trust the output, open `config.json` here on GitHub, click the pencil, change `"draft"` to `"now"`, and commit. Posts then publish without you.

## Things you can change in `config.json`

| Setting | What it does |
| --- | --- |
| `brand` | The name shown on the video. |
| `videoLabel` | The orange tag on the video, for example `TOP STORY`. |
| `postMode` | `draft` (you approve) or `now` (automatic). |
| `markAsAiGenerated` | Sets TikTok's AI-generated label on each post. |
| `voice` | The narration voice. |
| `feeds` | The news outlets that are read. Add or remove lines. |

## If a run fails

Open the **Actions** tab, click the failed run, and click the red step to see its message. Step 1 lists which news feeds answered. A feed that fails is skipped; the run only stops if fewer than three answer.
