import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Events that grant Pro access
const PRO_EVENTS = new Set(['INITIAL_PURCHASE', 'RENEWAL']);

// Events that revoke Pro access
const REVOKE_EVENTS = new Set([
  'CANCELLATION',
  'EXPIRATION',
  'REFUND',
  'BILLING_ISSUE_DETECTED',
]);

Deno.serve(async (req: Request) => {
  // RevenueCat sends: Authorization: Bearer <secret>
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? '';

  if (!secret || token !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const event = body.event as Record<string, unknown> | undefined;
  const eventType = event?.type as string | undefined;
  const appUserId = event?.app_user_id as string | undefined;

  if (!eventType || !appUserId) {
    // Not an event shape we recognise — acknowledge silently so RevenueCat
    // doesn't retry indefinitely for unrecognised payload structures.
    return new Response('OK', { status: 200 });
  }

  let isPro: boolean | null = null;
  if (PRO_EVENTS.has(eventType)) {
    isPro = true;
  } else if (REVOKE_EVENTS.has(eventType)) {
    isPro = false;
  } else {
    // Unhandled event type (e.g. PRODUCT_CHANGE, TRIAL_STARTED) — acknowledge
    return new Response('OK', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { error } = await supabase
    .from('profiles')
    .update({ is_pro: isPro })
    .eq('id', appUserId);

  if (error) {
    console.error('Failed to update is_pro:', error.message);
    return new Response('Internal Server Error', { status: 500 });
  }

  console.log(`${eventType} → user ${appUserId} is_pro=${isPro}`);
  return new Response('OK', { status: 200 });
});
