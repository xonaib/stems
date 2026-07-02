# Stems — Progress

## Done ✅

- Single-file web app (no build step, opens in any browser)
- Add / delete branches with custom colors
- Smart log modal — type to search existing branches, auto-creates new ones on first use
- Log entry: branch + time (minutes) + optional note
- 90-day heatmap per branch (GitHub contribution style)
- Weekly bar chart — this week vs last week, per branch
- Today's sessions panel on dashboard
- Full history view grouped by date
- Streak counter (consecutive days with at least one log)
- Hourly browser notifications (Web Notifications API)
- Quiet hours setting — silence reminders between two times (handles midnight crossover)
- Light / dark theme toggle, preference persisted
- Export data as JSON backup
- Import JSON backup (merges, no duplicates)
- README

---

## In Progress 🔄

- PWA manifest + service worker (for Add to Home Screen on iOS/Android)

## Deployed 🚀

- **Live:** https://stems-three.vercel.app
- GitHub: https://github.com/xonaib/stems
- Hosting: Vercel (auto-deploys on push to main)

---

## Planned 📋

### Must have
- [ ] PWA manifest + service worker (for Add to Home Screen on iOS/Android)
- [ ] Supabase backend — cross-device sync, auth via magic link
- [ ] Row Level Security on Supabase (data locked to your user only)
- [ ] Background push notifications via service worker (works even when app is closed)

### Nice to have
- [ ] Weekly summary view — breakdown of where time went
- [ ] Per-branch goal setting (e.g. "I want 5h/week on DSA")
- [ ] Progress bar toward weekly goal per branch
- [ ] Edit or delete individual log entries
- [ ] Reorder / pin branches
- [ ] Branch color editing after creation
- [ ] Onboarding flow for first-time use
- [ ] Share / export a weekly summary image

### Maybe
- [ ] iOS Shortcut template for hourly reminder fallback
- [ ] Simple notes per branch (not per session — a running scratchpad)
- [ ] Tag logs (e.g. "deep work", "reading", "practice")
