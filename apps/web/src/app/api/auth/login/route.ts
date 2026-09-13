import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url, { status: 307 });
}

export async function POST(request: Request) {
  const url = new URL('/login', request.url);
  return NextResponse.redirect(url, { status: 307 });
}
