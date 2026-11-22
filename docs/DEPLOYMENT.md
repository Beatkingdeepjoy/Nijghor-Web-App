# Deploying Nijghor: Vercel (Frontend) + Render (Backend)

The **Vercel + Render** combination provides the ideal architecture for Nijghor:
1. **Frontend on Vercel**: Global Edge CDN delivery, instant asset caching, automatic HTTPS, and PWA capabilities with sub-50ms TTFB worldwide.
2. **Backend & Ephemeral Relay on Render**: Persistent Go 1.22 container maintaining stateful, low-latency WebSocket connections alongside managed PostgreSQL and Redis instances.

---

## Part 1: Deploy Backend & Databases on Render (5 minutes)

Render provides a turnkey "Blueprint" (`render.yaml`) included in the root of this repository.

1. **Sign in to Render**: Go to [dashboard.render.com](https://dashboard.render.com).
2. **Create New Blueprint**:
   - Click **New +** -> **Blueprint**.
   - Connect your GitHub repository: `https://github.com/Beatkingdeepjoy/Nijghor-Web-App`.
   - Render will detect [render.yaml](render.yaml) and automatically configure:
     - 🗄️ **Managed PostgreSQL**: `nijghor-postgres` (Database for accounts and public prekeys).
     - ⚡ **Managed Redis**: `nijghor-redis` (Ephemeral offline message queue & presence).
     - 🚀 **Web Service**: `nijghor-server` (Go 1.22 binary WebSocket relay).
3. **Set Environment Variables on Render**:
   - `APP_BASE_URL`: Set to your Vercel URL (e.g. `https://your-app.vercel.app`) to allow CORS credentials.
   - Click **Apply** to deploy.
4. **Copy Your Backend URL**:
   - Once deployed, Render will give you a public URL like:
     `https://nijghor-server.onrender.com`

---

## Part 2: Deploy Frontend on Vercel (2 minutes)

1. **Sign in to Vercel**: Go to [vercel.com](https://vercel.com).
2. **Import Git Repository**:
   - Click **Add New...** -> **Project**.
   - Select `Beatkingdeepjoy/Nijghor-Web-App`.
3. **Configure Project Settings**:
   - **Framework Preset**: Vite
   - **Root Directory**: `web` (Click "Edit" and select the `web` folder)
4. **Add Environment Variables**:
   In the Vercel project configuration, add two variables pointing to your Render backend:
   - `VITE_API_URL`: `https://nijghor-server.onrender.com`
   - `VITE_WS_URL`: `wss://nijghor-server.onrender.com`
5. **Deploy**:
   - Click **Deploy**.
   - Vercel will build and publish your PWA at `https://<your-project>.vercel.app`.

---

## Part 3: Verify the Live Setup

1. Open your Vercel URL in your browser.
2. Complete the 30-second onboarding:
   - Enter your email, receive the 6-digit code.
   - Choose your `@username`.
   - Download your `.nijghor` recovery key.
3. Test user discovery:
   - Open a private/incognito window (or another device).
   - Sign up with a second `@username`.
   - Click the **Find User** icon (👤+) and search for your first username.
   - Click **Message**; type a message.
   - Watch the house-tick progress from **Outline** (sent) to **Filled** (delivered) to **Glowing** (read).
