# NoProxy — Backend API Service (Render)

Production-ready Node.js + Express + TypeScript API service for **NoProxy Smart Attendance Management SaaS**.

## 🚀 One-Click Render Deployment

1. On [dashboard.render.com](https://dashboard.render.com), click **New +** → **Web Service**.
2. Connect repository: **`voidrohan25/noproxy-backend`**.
3. Render automatically detects everything from the root!
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `FRONTEND_URL`: URL of your deployed frontend (e.g., `https://noproxy-frontend.vercel.app`)
   - `QR_SIGNING_SECRET`: 64-char random hex string

## 🧪 Local Testing & Verification

```bash
# Run 8/8 automated test suites
npm test

# Build TypeScript to dist/server.js
npm run build

# Start production server
npm start
```
