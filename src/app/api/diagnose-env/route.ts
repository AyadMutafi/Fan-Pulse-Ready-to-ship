import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    ZAI_BASE_URL: process.env.ZAI_BASE_URL || '(not set)',
    ZAI_API_KEY: process.env.ZAI_API_KEY ? `${process.env.ZAI_API_KEY.slice(0, 8)}...` : '(not set)',
    ZAI_TOKEN: process.env.ZAI_TOKEN ? 'set' : '(not set)',
    NODE_ENV: process.env.NODE_ENV || '(not set)',
  })
}
