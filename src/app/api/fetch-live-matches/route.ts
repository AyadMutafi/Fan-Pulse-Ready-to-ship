*** Begin Patch
*** Update File: src/app/api/fetch-live-matches/route.ts
@@
-import { NextResponse } from 'next/server'
-import ZAI from 'z-ai-web-dev-sdk'
+import { NextResponse } from 'next/server'
+import { getSdk } from '@/lib/ai/providers/zai'
@@
-    const zai = await ZAI.create()
+    const zai = await getSdk()
+    if (!zai) {
+      return NextResponse.json({ error: 'Z.ai SDK unavailable' }, { status: 503 })
+    }
*** End Patch