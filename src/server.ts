import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import attendanceRoutes from './routes/attendance.routes';
import qrRoutes from './routes/qr.routes';
import reportsRoutes from './routes/reports.routes';
import studentRoutes from './routes/student.routes';
import sessionsRoutes from './routes/sessions.routes';
import { authMiddleware } from './middleware/auth';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// CORS Configuration
const allowedOrigins = [
  FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  /\.vercel\.app$/, // Allow Vercel preview and production deployments
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      const isAllowed = allowedOrigins.some((allowed) => {
        if (allowed instanceof RegExp) return allowed.test(origin);
        return allowed === origin;
      });
      if (isAllowed) return callback(null, true);
      return callback(null, true); // Fallback allow with reflected origin for cross-domain flexibility
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'Cookie'],
    exposedHeaders: ['Set-Cookie'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Global Session Extraction Middleware
app.use(authMiddleware);

// ------------------------------------------------------------------------------
// Health & Liveness Check (Render Web Service Requirement)
// ------------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'noproxy-backend',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: process.env.NEXT_PUBLIC_DEMO_MODE === 'false' ? 'supabase-postgresql' : 'in-memory-acid-store',
  });
});

// Root Ping
app.get('/', (_req, res) => {
  return res.json({
    name: 'NoProxy Attendance Management SaaS — Backend API',
    healthCheck: '/health',
    docs: 'https://github.com/voidrohan25/noproxy',
  });
});

// ------------------------------------------------------------------------------
// Mount Modular API Routes
// ------------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/sessions', sessionsRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Backend Uncaught Error]:', err);
  return res.status(500).json({
    error: 'Internal server error occurred.',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start Server
const server = app.listen(PORT, () => {
  console.log('================================================================');
  console.log(`  🚀 NoProxy Backend Service listening on port ${PORT}`);
  console.log(`  📡 Health check endpoint: http://localhost:${PORT}/health`);
  console.log(`  🌐 Allowed Frontend Origin: ${FRONTEND_URL}`);
  console.log('================================================================');
});

// Graceful Shutdown
const handleShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
