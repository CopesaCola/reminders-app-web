import 'server-only';
import webpush from 'web-push';
import { db } from './db';
import { pushSubscriptions, reminderLog } from './schema';
import { eq } from 'drizzle-orm';

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) return;
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  goalId?: number;
  // Buttons users can click directly from the notification.
  actions?: { action: string; title: string }[];
};

export async function sendPushToAll(
  payload: PushPayload,
  kind: 'reminder' | 'nudge' | 'digest' | 'test' = 'reminder'
) {
  configure();
  if (!configured) {
    console.warn('[push] VAPID not configured, skipping');
    return { sent: 0, failed: 0 };
  }
  const subs = await db.select().from(pushSubscriptions);
  let sent = 0;
  let failed = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload)
      );
      sent++;
    } catch (err: any) {
      failed++;
      // 410 Gone / 404 Not Found — subscription is dead, drop it.
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint));
      } else {
        console.error('[push] send failed', err?.statusCode, err?.body ?? err?.message);
      }
    }
  }
  await db.insert(reminderLog).values({
    goalId: payload.goalId ?? null,
    kind,
    payload: payload as any,
  });
  return { sent, failed };
}
