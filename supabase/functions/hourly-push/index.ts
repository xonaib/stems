import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!;
const CRON_SECRET   = Deno.env.get('CRON_SECRET')!;
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:zonaibshah@gmail.com', VAPID_PUBLIC, VAPID_PRIVATE);

Deno.serve(async (req) => {
  // Simple secret check so only cron-job.org can trigger this
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
  if (error) return new Response('DB error', { status: 500 });

  const now     = new Date();
  const hourUTC = now.getUTCHours();
  const dayUTC  = now.getUTCDay(); // 0=Sun … 6=Sat

  let sent = 0, skipped = 0;
  for (const row of subs ?? []) {
    try {
      // Check active days (stored in UTC day numbers)
      const activeDays: number[] = row.active_days ?? [1,2,3,4,5];
      if (!activeDays.includes(dayUTC)) { skipped++; continue; }

      // Check quiet hours (stored as "HH:MM" UTC)
      const [fH] = (row.quiet_from ?? '22:00').split(':').map(Number);
      const [tH] = (row.quiet_to   ?? '08:00').split(':').map(Number);
      const inQuiet = fH > tH
        ? hourUTC >= fH || hourUTC < tH
        : hourUTC >= fH && hourUTC < tH;
      if (inQuiet) { skipped++; continue; }

      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title: 'Stems 🌿', body: 'What did you work on this past hour?' })
      );
      sent++;
    } catch (e) {
      console.error('Push failed for', row.user_id, e.message);
      // Remove invalid subscriptions
      if (e.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', row.id);
      }
    }
  }

  return new Response(JSON.stringify({ sent, skipped }), {
    headers: { 'content-type': 'application/json' },
  });
});
