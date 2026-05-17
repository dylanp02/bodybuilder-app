import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo push API limit per request
const DAYS_THRESHOLD = 5;

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

// Protect against accidental direct calls — cron invocations pass the service
// role key as Authorization, which Supabase also injects as SUPABASE_SERVICE_ROLE_KEY.
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return token === serviceKey;
}

async function sendBatch(messages: ExpoPushMessage[]): Promise<void> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error(`Expo push batch failed: ${res.status} ${await res.text()}`);
    return;
  }

  const { data }: { data: ExpoPushTicket[] } = await res.json();
  const errors = data.filter(t => t.status === 'error');
  if (errors.length) {
    console.error('Expo push errors:', JSON.stringify(errors));
  }
  console.log(`Batch: ${data.length - errors.length} ok, ${errors.length} errors`);
}

Deno.serve(async (req: Request) => {
  if (!isAuthorized(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Step 1: Find all users who have logged weight within the threshold window
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - DAYS_THRESHOLD);
  const thresholdIso = thresholdDate.toISOString().split('T')[0];

  const { data: recentLoggers, error: logErr } = await supabase
    .from('weight_logs')
    .select('user_id')
    .gte('date', thresholdIso);

  if (logErr) {
    console.error('Failed to query weight_logs:', logErr.message);
    return new Response('Internal Server Error', { status: 500 });
  }

  const recentLoggerIds = new Set((recentLoggers ?? []).map(r => r.user_id));

  // Step 2: Fetch all profiles with a push token
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, push_token')
    .not('push_token', 'is', null);

  if (profErr) {
    console.error('Failed to query profiles:', profErr.message);
    return new Response('Internal Server Error', { status: 500 });
  }

  // Step 3: Filter to users who haven't logged in DAYS_THRESHOLD days
  const targets = (profiles ?? []).filter(p => !recentLoggerIds.has(p.id));

  if (!targets.length) {
    console.log('No users to notify');
    return new Response(JSON.stringify({ sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Step 4: Build and batch-send Expo push messages
  const messages: ExpoPushMessage[] = targets.map(p => ({
    to: p.push_token as string,
    title: 'Log your weight',
    body: "You haven't logged your weight in a few days. Keep your progress streak going.",
    sound: 'default',
    channelId: 'bodybuilderapp-reminders',
  }));

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    await sendBatch(messages.slice(i, i + BATCH_SIZE));
  }

  console.log(`bodyweight-reminder: sent ${messages.length} notifications`);
  return new Response(JSON.stringify({ sent: messages.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
