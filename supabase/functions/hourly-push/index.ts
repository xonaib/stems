import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const CRON_SECRET   = Deno.env.get('CRON_SECRET')!;
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:zonaibshah@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
  if (error) return new Response('DB error', { status: 500 });

  const nowUTC = new Date();
  let sent = 0, skipped = 0;

  for (const row of subs ?? []) {
    try {
      // Convert UTC to user's local time using their stored offset
      // utc_offset_minutes: JS getTimezoneOffset() value (negative for east of UTC)
      // e.g. PKT (UTC+5) = -300
      const offsetMs = (row.utc_offset_minutes ?? 0) * 60 * 1000;
      const localTime = new Date(nowUTC.getTime() - offsetMs);
      const localHour = localTime.getUTCHours();
      const localDay  = localTime.getUTCDay(); // 0=Sun … 6=Sat

      // Check active days in local time
      const activeDays: number[] = row.active_days ?? [1,2,3,4,5];
      if (!activeDays.includes(localDay)) { skipped++; continue; }

      // Check active hours in local time
      const [fH] = (row.active_from ?? '08:00').split(':').map(Number);
      const [tH] = (row.active_to   ?? '22:00').split(':').map(Number);
      const isActive = fH <= tH
        ? localHour >= fH && localHour < tH
        : localHour >= fH || localHour < tH;
      if (!isActive) { skipped++; continue; }

      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title: 'Stems 🌿', body: 'What did you work on this past hour?' })
      );
      sent++;
    } catch (e) {
      console.error('Push failed for', row.user_id, e.message);
      if (e.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id);
      }
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { 'content-type': 'application/json' },
  });
});
