# Fan Pulse — Deploy to Fly.io (Step-by-Step)

This guide takes you from zero to a live Fan Pulse deployment on Fly.io in about 30 minutes.
Fly.io is chosen because it supports your existing SQLite database (no migration needed) via
persistent volumes, has no function timeouts (important for the AI rating endpoint), and is
cheap for the soft launch (~$3–5/mo).

---

## Prerequisites

- A Fly.io account (free to create at https://fly.io)
- The `flyctl` CLI installed on your machine
- Your `ZAI_API_KEY` (for the z-ai-web-dev-sdk LLM calls)
- A strong admin password (generate one with `openssl rand -base64 32`) — MUST be set via the `ADMIN_PASSWORD` env var; there is no hardcoded default

---

## Step 1 — Install the Fly CLI

**macOS:**
```bash
brew install flyctl
```

**Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell):**
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Verify it installed:
```bash
fly version
```

---

## Step 2 — Sign up / Log in

If you don't have an account yet:
```bash
fly auth signup
```
(Follow the prompts — you'll need a credit card, but you won't be charged during the soft launch. The free allowance covers a small always-on app.)

If you already have an account:
```bash
fly auth login
```

---

## Step 3 — Pick your region

Choose the Fly region closest to most of your users for the lowest latency.

Common regions:
- `iad` — Washington, D.C. (US East)
- `sjc` — San Jose (US West)
- `lhr` — London (Europe)
- `sin` — Singapore (Asia)
- `dxb` — Dubai (Middle East) ← closest to your timezone (Asia/Aden)

See all regions:
```bash
fly platform regions
```

**Write down your chosen region code** — you'll need it in Step 5.

---

## Step 4 — Update `fly.toml` with your app name + region

Open `fly.toml` in your project and change two lines:

```toml
app = "fan-pulse"              # ← change to a unique name (e.g. "fan-pulse-yourname")
primary_region = "iad"         # ← change to your region from Step 3 (e.g. "dxb")
```

The app name must be globally unique on Fly — if `fan-pulse` is taken, try `fan-pulse-2026` or similar.

Also update the volume name in the `[[mounts]]` section to match your app name:
```toml
[[mounts]]
  source = "fan_pulse_db"      # ← this is fine as-is, it's a volume name not the app name
```

---

## Step 5 — Create the app on Fly

From your project root:

```bash
fly launch --no-deploy
```

This will:
- Detect your `Dockerfile` + `fly.toml`
- Create the app on Fly's infrastructure
- Ask you a few setup questions (answer yes to "Would you like to set up a Postgresql database?" → **No**, you're using SQLite)

If it asks to modify your `fly.toml`, say **No** — your config is already correct.

---

## Step 6 — Create the persistent volume for SQLite

This is the most important step — the volume is what keeps your curated tweets,
AI ratings, and fan votes safe across redeploys.

```bash
fly volumes create fan_pulse_db --region dxb --size 1
```

Replace `dxb` with your region from Step 3. The `--size 1` means 1GB, which is
plenty for SQLite (your DB is currently < 1MB).

Verify it was created:
```bash
fly volumes list
```

You should see `fan_pulse_db` in the list.

---

## Step 7 — Set your secrets

Set the API key and admin password as Fly secrets (these become environment variables
in the container, never baked into the image):

```bash
fly secrets set ZAI_API_KEY="your-actual-api-key-here"
```

Set the admin password as a Fly secret (REQUIRED — the app fails closed if unset):
```bash
NEW_PW=$(openssl rand -base64 32)
fly secrets set ADMIN_PASSWORD="$NEW_PW"
```
Save the generated password somewhere secure (password manager) — it will not be shown again.

---

## Step 8 — Deploy!

```bash
fly deploy
```

This will:
1. Build the Docker image (using your `Dockerfile`)
2. Push it to Fly's registry
3. Start a Machine with your persistent volume attached
4. Run the health check
5. Route traffic to it

The first build takes ~3–5 minutes (subsequent builds are faster due to caching).

When it's done, you'll see output like:
```
Deployment ID: abc123-def456
Deployed fan-pulse to URL: https://fan-pulse.fly.dev
```

---

## Step 9 — Verify it's live

Open your deployment URL in a browser:
```
https://<your-app-name>.fly.dev
```

Check these things:
- [ ] Home page loads with Featured Matches
- [ ] Team flags render (from flagcdn.com)
- [ ] Fan Mood voting carousel works (click a team → modal opens → vote → checkmark appears)
- [ ] World Cup tab shows stages and player cards
- [ ] Admin panel at `/admin/feed-monitor` — log in with your `ADMIN_PASSWORD` env var and verify tweet curation + AI rating works

Test the health endpoint:
```bash
curl https://<your-app-name>.fly.dev/api/health
```
Should return: `{"status":"ok","timestamp":"...","uptime":...}`

---

## Step 10 — Seed the database (first time only)

The first time the app boots, the SQLite DB is created empty by the entrypoint script.
To populate it with World Cup match data, hit the seed endpoint:

```bash
curl -X POST https://<your-app-name>.fly.dev/api/world-cup/seed
```

You should get a `200` response with the number of matches/players created.

> The app also auto-seeds on page load if the DB is empty, but calling the endpoint
> directly is more reliable for the first deploy.

---

## Step 11 — Add a custom domain (optional but recommended for launch)

Using `fan-pulse.fly.dev` is fine for the soft launch, but for the hard launch you'll
want a real domain like `fanpulse.app`.

```bash
fly certs add fanpulse.app
```

Fly will give you DNS records (A and AAAA) to add at your domain registrar. Once DNS
propagates, Fly issues a TLS certificate automatically.

---

## Step 12 — Set up monitoring (optional but smart)

### Uptime monitoring
Create a free monitor at https://uptimerobot.com pointing to:
```
https://<your-app-name>.fly.dev/api/health
```
It'll ping every 5 minutes and email you if the site goes down.

### View live logs
```bash
fly logs
```
Keep this running in a terminal during the soft launch to catch any runtime errors.

### SSH into the machine (for debugging)
```bash
fly ssh console
```
This drops you into a shell on the running container. Useful for inspecting the DB:
```bash
ls -la /app/db/
# -> custom.db  (should be there and growing as you curate tweets)
```

---

## Ongoing operations

### Deploy an update
Whenever you change code:
```bash
fly deploy
```
Your SQLite data is safe — it lives on the persistent volume, not in the image.

### Back up the database (do this weekly during soft launch)
```bash
fly ssh sftp get /app/db/custom.db ./backup-$(date +%Y%m%d).db
```
Store the backup file somewhere safe (Google Drive, a private Git repo, etc.).

### Scale up for the hard launch (Jun 28)
Before the knockout round, bump the VM size:
```bash
fly scale vm shared-cpu-2x --memory 1024
```
And optionally add a second region for redundancy:
```bash
fly scale count 2 --region dxb,iad
```

### Check your bill
```bash
fly status
fly vm status
```
The soft launch (1× shared-cpu, 512MB, 1GB volume) costs ~$3–5/mo.

---

## Troubleshooting

### "Deployment failed" during build
Check the build logs for the specific error. Common causes:
- Missing env var → set it with `fly secrets set`
- Prisma generate failed → the Dockerfile runs `bunx prisma generate` in the deps stage; make sure `prisma/schema.prisma` is committed

### App loads but "Database error" on the page
SSH in and check:
```bash
fly ssh console
ls -la /app/db/
cat /app/db/custom.db | wc -c   # should be > 0
```
If the DB file is missing or empty, the entrypoint script may have failed. Run it manually:
```bash
bunx prisma db push --skip-generate --accept-data-loss
curl -X POST http://localhost:3000/api/world-cup/seed
```

### AI rating endpoint times out
The LLM call can take 10–20s. Fly has no default timeout, but if you're behind a proxy
or CDN, check its timeout setting. The endpoint itself is fine.

### Flags not rendering
The flag images come from `flagcdn.com`. If they're not showing, check if the container
can reach the internet:
```bash
fly ssh console
curl -I https://flagcdn.com/w80/br.png
```
Should return `200 OK`.

---

## What's deployed where

| Component | Location |
|---|---|
| Next.js app (standalone) | Fly.io Machine (Docker container) |
| SQLite database | Fly.io persistent volume (`/app/db/custom.db`) |
| Flag images | flagcdn.com CDN (external) |
| AI LLM calls | z-ai-web-dev-sdk (calls ZAI API from the container) |
| Admin auth | `ADMIN_PASSWORD` env var (timing-safe compared); REQUIRED, no hardcoded default |
| Secrets (`ZAI_API_KEY`) | Fly secrets (encrypted at rest) |

---

## Rollback if something goes wrong

List recent deployments:
```bash
fly deployments list
```

Roll back to the previous version:
```bash
fly deploy --image-label previous
```

Your database is never affected by rollbacks — it's on the volume, separate from the app image.
