// src/lib/zai.ts
let _zai: any = null

export async function getZAI(config?: any) {
  if (_zai) return _zai
  const ZAIModule = await import('z-ai-web-dev-sdk')
  const sdk = ZAIModule?.default ?? ZAIModule
  // If SDK exposes create() returning an instance:
  _zai = typeof sdk.create === 'function' ? await sdk.create(config) : sdk
  return _zai
}
