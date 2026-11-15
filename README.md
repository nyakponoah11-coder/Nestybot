# Data Ease Shop 📱🇬🇭

A modern, fast, and responsive online storefront for purchasing **MTN**, **Telecel**, and **AirtelTigo (AT)** data bundles, examination result checkers (WAEC/BECE), and digital subscriptions in Ghana.

Built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Supabase**. Ready to deploy directly to **Vercel** with your own self-managed Supabase backend.

---

## 🚀 Quick Start: Deploying to Vercel

### Step 1: Import Project into Vercel
1. Push this repository to your GitHub account.
2. Go to [Vercel](https://vercel.com) and click **"Add New"** > **"Project"**.
3. Select your repository.
4. Vercel automatically detects the Vite configuration:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

### Step 2: Configure Environment Variables in Vercel
In your Vercel Project Settings > **Environment Variables**, add:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Your Supabase Project URL | `https://xyzcompany.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase Anon/Public Key | `eyJhbGciOiJIUzI1Ni...` |

*(Optional alias supported)*: `VITE_SUPABASE_PUBLISHABLE_KEY` can be used instead of `VITE_SUPABASE_ANON_KEY`.

Click **Deploy**! The included `vercel.json` ensures all client-side routes (`/network/:network`, `/services`, `/track`, `/admin/*`) work without 404s.

---

## 🗄️ Setting Up Your Own Supabase Backend

### 1. Create a Supabase Project
1. Log in to [Supabase](https://supabase.com) and create a new project.
2. Under **Project Settings** > **API**, copy your:
   - **Project URL**
   - **anon / public key**

### 2. Run the Consolidated Database Schema
1. In your Supabase Dashboard, open the **SQL Editor** in the left sidebar.
2. Click **New Query**.
3. Open [`supabase/schema.sql`](./supabase/schema.sql) in this repo, copy all of its content, and paste it into the SQL Editor.
4. Click **Run**.

This one script sets up:
- ✅ Enum types (`app_role` with `admin`, `user`, `support`)
- ✅ Core tables: `products`, `orders`, `settings`, `profiles`, `user_roles`
- ✅ Additional service tables: `service_orders` (Netflix, AFA), `checker_orders` (WAEC/BECE), `spin_wins`, `referrals`
- ✅ Live customer support tables: `chat_conversations`, `chat_messages`
- ✅ Supabase Storage bucket for chat uploads (`chat-uploads`)
- ✅ Row Level Security (RLS) policies and triggers
- ✅ Seeded MTN, Telecel, and AT data packages and default shop settings

### 3. Create Your Admin User
1. Open your deployed website or local app and go to `/admin/login`.
2. Sign up with your email and password.
3. In your Supabase Dashboard, open **SQL Editor** and run:
   ```sql
   -- Find your user id:
   SELECT id, email FROM auth.users;

   -- Grant admin role (replace <YOUR_USER_ID> with the UUID from above):
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('<YOUR_USER_ID>', 'admin')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```
4. Log in at `/admin/login` to access the full admin dashboard!

---

## ⚡ Supabase Edge Functions (Optional for Full Automation)

The project includes serverless backend functions in `supabase/functions/` for:
- `paystack-init` & `paystack-verify` (Mobile Money and Card payments via Paystack)
- `shop-data` (Storefront caching)
- `delivery-tracker` & `track-order` (Order status tracking)
- `chat` (Live support assistant)
- `bulk-sms` (SMS updates to buyers)
- `spin-claim` & `referral-apply` (Promotions and referral engine)

### Setting Edge Function Secrets
In your Supabase project dashboard (**Project Settings** > **Edge Functions** > **Secrets**), or using Supabase CLI:
```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_...
supabase secrets set SITE_URL=https://your-domain.vercel.app
```

Deploy the functions using the Supabase CLI:
```bash
supabase functions deploy
```

---

## 💻 Local Development

1. Clone your repository:
   ```bash
   git clone https://github.com/<your-username>/data-ease-shop.git
   cd data-ease-shop
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```bash
   cp .env.example .env
   ```
   Add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

4. Start development server:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. Build for production:
   ```bash
   npm run build
   ```

---

## 📁 Project Structure

```text
├── index.html                   # HTML entry point with metadata
├── package.json                 # npm dependencies & build scripts
├── vercel.json                  # Vercel SPA routing configuration
├── vite.config.ts               # Vite configuration
├── supabase/
│   ├── schema.sql               # Complete consolidated SQL schema (paste into Supabase)
│   ├── functions/               # Supabase Edge Functions (Deno)
│   └── migrations/              # Incremental SQL migrations
└── src/
    ├── pages/                   # Route pages (Shop, Bundles, Services, Track, Admin)
    ├── components/              # UI components and dialogs
    ├── integrations/supabase/   # Supabase client setup
    └── lib/                     # Networks, formatting, and helper utilities
```

---

## 🛡️ License
Private repository for personal/commercial deployment.
