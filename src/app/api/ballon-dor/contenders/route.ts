*** Begin Patch
*** Update File: src/app/api/ballon-dor/contenders/route.ts
@@
-    let contender
-    if (id) {
-      contender = await db.ballonDorContender.update({
-        where: { id },
-        data: { name, clubName, clubCode: clubCode || '', nationCode, position: position || 'ST', adminNotes: adminNotes ?? null, manualBuzzScore: manualBuzzScore ?? null, verifiedMatchFact: verif[...]
-      })
-    } else {
-      contender = await db.ballonDorContender.create({
-        data: { name, clubName, clubCode: clubCode || '', nationCode, position: position || 'ST', adminNotes: adminNotes ?? null, manualBuzzScore: manualBuzzScore ?? null, verifiedMatchFact: verif[...]
-      })
-    }
+    let contender
+    if (id) {
+      // Build update payload and apply manual override to ballonDorScore when provided
+      const updateData: any = {
+        name,
+        clubName,
+        clubCode: clubCode || '',
+        nationCode,
+        position: position || 'ST',
+        adminNotes: adminNotes ?? null,
+        manualBuzzScore: manualBuzzScore ?? null,
+        verifiedMatchFact: verifiedMatchFact ?? null,
+        reason: reason ?? null,
+        isActive: isActive ?? true,
+      }
+      if (typeof manualBuzzScore === 'number') {
+        updateData.ballonDorScore = manualBuzzScore
+      }
+      contender = await db.ballonDorContender.update({ where: { id }, data: updateData })
+    } else {
+      // When creating a new contender, if a manualBuzzScore is supplied use it
+      // as the initial ballonDorScore so the UI reflects the admin's override.
+      const createData: any = {
+        name,
+        clubName,
+        clubCode: clubCode || '',
+        nationCode,
+        position: position || 'ST',
+        adminNotes: adminNotes ?? null,
+        manualBuzzScore: manualBuzzScore ?? null,
+        ballonDorScore: typeof manualBuzzScore === 'number' ? manualBuzzScore : 50,
+        verifiedMatchFact: verifiedMatchFact ?? null,
+        reason: reason ?? null,
+        isActive: isActive ?? true,
+      }
+      contender = await db.ballonDorContender.create({ data: createData })
+    }
*** End Patch