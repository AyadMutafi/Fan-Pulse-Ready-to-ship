#!/bin/bash
# Patch z-ai-web-dev-sdk to support env var fallback when no .z-ai-config file exists.
# This is needed for Docker/Render deployments where writing config files is unreliable.

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

# Replace the throw with an env var fallback
# Original: throw new Error('Configuration file not found...')
# Patched: falls back to env vars, then throws if those aren't set either
python3 -c "
import re

with open('$SDK_FILE', 'r') as f:
    content = f.read()

old = \"throw new Error('Configuration file not found or invalid. Please create .z-ai-config in your project, home directory, or /etc.');\"

new = '''// PATCHED: Fall back to env vars if no config file found
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
    throw new Error('Configuration file not found or invalid. Please create .z-ai-config in your project, home directory, or /etc/. Alternatively, set ZAI_API_KEY environment variable.');'''

content = content.replace(old, new)

with open('$SDK_FILE', 'w') as f:
    f.write(content)

print('[patch-zai-sdk] ✓ Patched loadConfig to support ZAI_API_KEY env var fallback')
"

