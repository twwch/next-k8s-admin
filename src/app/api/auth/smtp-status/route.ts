import { NextResponse } from 'next/server';

export async function GET() {
  const enabled = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return NextResponse.json({ enabled });
}
