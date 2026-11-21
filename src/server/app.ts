import path from 'path';
import express, { type Request, type Response, type NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { ensureUploadDirs, UPLOADS_ROOT } from './utils/uploads.ts';
import authRoutes from './routes/auth.ts';
import academicsRoutes from './routes/academics.ts';
import communicationsRoutes from './routes/communications.ts';
import communityRoutes from './routes/community.ts';
import campusLifeRoutes from './routes/campusLife.ts';
import adminRoutes from './routes/admin.ts';
import aiRoutes from './routes/ai.ts';
import openApiRoutes from './openapi.ts';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  ensureUploadDirs();

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Scoped CORS for same-origin and configured APP_URL
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigin = process.env.APP_URL;
    if (origin && (origin === allowedOrigin || origin.includes('localhost') || origin.includes('.run.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', apiLimiter);

  // Serve only public image/avatar uploads statically; academic resources go through RBAC download endpoint
  app.use(
    '/uploads/images',
    express.static(path.join(UPLOADS_ROOT, 'images'), { maxAge: '7d' })
  );
  app.use(
    '/uploads/avatars',
    express.static(path.join(UPLOADS_ROOT, 'avatars'), { maxAge: '7d' })
  );

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ttu-hub' });
  });

  app.use('/api', openApiRoutes);
  app.use('/api/auth', strictLimiter, authRoutes);
  app.use('/api/academics', academicsRoutes);
  app.use('/api/communications', communicationsRoutes);
  app.use('/api/community', communityRoutes);
  app.use('/api/campus', campusLifeRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/ai', strictLimiter, aiRoutes);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Uploaded file exceeds the maximum allowed size limit.' });
    }
    console.error('Unhandled server error:', err);
    res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
