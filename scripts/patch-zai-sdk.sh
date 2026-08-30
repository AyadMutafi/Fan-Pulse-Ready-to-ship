#!/bin/sh
# Patch z-ai-web-dev-sdk to support env var fallback when no .z-ai-config file exists.
# This is needed for Docker/Render deployments where writing config files is unreliable.
#
# Uses only sed + grep (no python3 needed) so it works in node:20-slim.
# Runs as a postinstall hook after npm install.

SDK_FILE="node_modules/z-ai-web-dev-sdk/dist/index.js"

if [ ! -f "$SDK_FILE" ]; then
  echo "[patch-zai-sdk] SDK file not found, skipping patch"
  exit 0
fi

# Check if already patched
if grep -q "ZAI_API_KEY" "$SDK_FILE"; then
  echo "[patch-zai-sdk] Already patched, skipping"
  exit 0
fi

# Use sed to replace the throw with an env var fallback.
# The original line is:
#   throw new Error('Configuration file not found or invalid. Please create .z-ai-config in your project, home directory, or /etc.');
#
# We replace it with a block that checks env vars first.

# Create the replacement text in a temp file
cat > /tmp/zai-patch.txt << 'PATCH'
// PATCHED: Fall back to env vars if no config file found
    if (process.env.ZAI_API_KEY) {
        const envConfig = {
            baseUrl: process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1',
            apiKey: process.env.ZAI_API_KEY,
        };
        if (process.env.ZAI_TOKEN) envConfig.token = process.env.ZAI_TOKEN;
        if (process.env.ZAI_CHAT_ID) envConfig.chatId = process.env.ZAI_CHAT_ID;
        if (process.env.ZAI_USER_ID) envConfig.userId = process.env.ZAI_USER_ID;
        console.log('[z-ai-sdk] Using env var config (ZAI_API_KEY detected)');
        return envConfig;
    }
    throw new Error('Configuration file not found. Set ZAI_API_KEY env var or create .z-ai-config file.');
PATCH

# Use sed to do the replacement
# The original line contains single quotes and special chars, so we use a different approach:
# 1. Find the line number of the throw
# 2. Delete it
# 3. Insert our replacement
LINE_NUM=$(grep -n "throw new Error.*Configuration file not found" "$SDK_FILE" | head -1 | cut -d: -f1)

if [ -z "$LINE_NUM" ]; then
  echo "[patch-zai-sdk] Could not find the throw line, skipping"
  rm -f /tmp/zai-patch.txt
  exit 0
fi

# Delete the throw line and insert our replacement
sed -i "${LINE_NUM}d" "$SDK_FILE"
sed -i "${LINE_NUM}r /tmp/zai-patch.txt" "$SDK_FILE"
rm -f /tmp/zai-patch.txt

echo "[patch-zai-sdk] ✓ Patched loadConfig to support ZAI_API_KEY env var fallback (sed)"
