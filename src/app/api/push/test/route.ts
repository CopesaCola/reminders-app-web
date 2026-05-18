import { NextResponse } from 'next/server';
import { sendPushToAll } from '@/lib/push';

export async function POST() {
  const result = await sendPushToAll(
    {
      title: 'Test reminder',
      body: 'Push notifications are working ✓',
      url: '/',
      tag: 'test',
    },
    'test'
  );
  return NextResponse.json(result);
}
