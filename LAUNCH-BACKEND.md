# Live Social Data — Backend Setup

To get **live data** from Instagram and YouTube, the app needs:

1. **Vercel** — hosts the app + API
2. **Supabase** — stores OAuth tokens
3. **Meta (Facebook)** — Instagram OAuth + Graph API
4. **Google Cloud** — YouTube OAuth + API

---

## Step 1: Supabase

1. Go to [supabase.com](https://supabase.com) → create a project
2. In **SQL Editor**, run the contents of `supabase-schema.sql`
3. In **Settings → API**, copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (under "Project API keys") → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Meta for Developers (Instagram)

**Requirement:** Instagram must be a **Business or Creator** account linked to a **Facebook Page**.

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create an app (type: **Business**)
3. Add **Facebook Login** and **Instagram Graph API** products
4. In **Facebook Login → Settings**, add Valid OAuth Redirect URI: `https://YOUR-DOMAIN.vercel.app/api/auth/instagram/callback`
5. In **App Settings → Basic**, copy:
   - **App ID** → `META_APP_ID`
   - **App Secret** → `META_APP_SECRET`
6. In **Meta Business Settings**, ensure your Instagram Business/Creator account is linked to a Facebook Page you manage

---

## Step 3: Google Cloud (YouTube)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project or select one
3. Enable **YouTube Data API v3** (APIs & Services → Library → search "YouTube Data")
4. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: **Web application**
   - Authorized redirect URIs: `https://YOUR-DOMAIN.vercel.app/api/auth/youtube/callback`
   - Copy **Client ID** → `GOOGLE_CLIENT_ID`
   - Copy **Client secret** → `GOOGLE_CLIENT_SECRET`

---

## Step 4: Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → Import your repo
3. Add **Environment Variables**:
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (YouTube)
   - `META_APP_ID`, `META_APP_SECRET` (Instagram)
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `BASE_URL` = `https://your-app.vercel.app` (your Vercel deployment URL)

4. Deploy

---

## Step 5: Use the App

1. Open **Post Analytics**
2. Select the business you want to sync to
3. **Instagram:** Click **Connect Instagram** → sign in with Facebook (your Instagram must be linked to a Page) → **Sync Instagram**
4. **YouTube:** Click **Connect YouTube** → sign in with Google → **Sync YouTube**
5. Synced posts appear in the table. Run **Get AI insights** for analysis

---

## Local Testing

```bash
vercel dev
```

Add the same env vars to `.env.local`. Set `BASE_URL` to your local URL (e.g. `http://localhost:3000`).

---

## Data Backup

- **Export backup** — Settings → Data & backup → Export backup
- **Import backup** — Settings → Data & backup → Import backup
- Manual and synced posts are all stored in your browser and included in the export
