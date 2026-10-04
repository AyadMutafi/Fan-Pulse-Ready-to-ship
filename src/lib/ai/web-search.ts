*** Begin Patch
*** Update File: src/lib/ai/web-search.ts
@@
-import ZAI from 'z-ai-web-dev-sdk'
+import { getSdk } from '@/lib/ai/providers/zai'
@@
-let cachedZai: any = null
-
-async function getClient(): Promise<any | null> {
-  if (cachedZai) return cachedZai
-  try {
-    cachedZai = await ZAI.create()
-    return cachedZai
-  } catch (err) {
-    console.warn(`[ai/web-search] SDK init failed: ${String(err).slice(0, 150)}`)
-    return null
-  }
-}
+// Use shared provider which honors process.env.ZAI_BASE_URL
+async function getClient(): Promise<any | null> {
+  try {
+    return await getSdk()
+  } catch (err) {
+    console.warn(`[ai/web-search] SDK init failed: ${String(err).slice(0, 150)}`)
+    return null
+  }
+}
*** End Patch