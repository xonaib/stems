# Stems

A personal time tracker for things that matter to you — goals, habits, or anything you want to spend more time on.

## What it does

- **Log sessions** — pick a branch, enter time spent, add an optional note
- **Auto-creates branches** — type anything in the log modal; if it's new, it becomes a branch
- **90-day heatmap** — see consistency at a glance, per branch
- **Weekly chart** — hours this week vs last week, per branch
- **Hourly reminders** — browser notifications that ping you to log what you worked on
- **Quiet hours** — set a window where reminders are silenced (e.g. 10pm–8am)
- **Light/dark theme**
- **Export/import JSON** — backup your data anytime

## Stack

Single HTML file. No build step, no framework, no backend (yet).

- **Storage**: `localStorage` — data stays on your device, fully private
- **Charts**: Chart.js (loaded from CDN)
- **Notifications**: Web Notifications API

## Running it

Open `index.html` in any browser. That's it.

## Mobile (iOS / Android)

1. Deploy to any static host (Vercel recommended — free, takes 2 minutes)
2. Open the deployed URL in Safari (iOS) or Chrome (Android)
3. **iOS**: Tap Share → Add to Home Screen
4. **Android**: Tap menu → Add to Home Screen
5. Enable notifications when prompted — hourly reminders will work from the home screen icon

## Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# From this folder
vercel
```

Or connect this repo in the Vercel dashboard — it'll auto-deploy on every push.

## Planned

- [ ] Supabase backend for cross-device sync (data stays private via Row Level Security)
- [ ] Service worker for offline support + background push notifications
- [ ] Weekly summary view
- [ ] Goals vs. freeform branch distinction

## Data privacy

All data lives in your browser's `localStorage`. Nothing is sent anywhere. Export your data anytime via the export button in the Branches tab.

When Supabase sync is added: your data will be stored in a Supabase project you own, protected by Row Level Security — only your authenticated user can read or write it.
