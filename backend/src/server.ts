import express from 'express';
import cors from 'cors';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { requestContext } from './lib/context.js';
import { advertiseClinic, clinicIdentity, discoveryEnabled } from './lib/clinicDiscovery.js';
import { PORT, AWS_REGION, DYNAMODB_TABLE_NAME } from './config/aws.js';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import tokenRoutes from './routes/tokenRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';

// Resolve frontend dist directory (support running from root or backend folder)
const distPath = path.resolve(
  process.cwd(),
  process.cwd().endsWith('backend') ? '../dist' : 'dist',
);

export const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      const allowed = (
        process.env.CORS_ORIGINS ||
        'http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173,http://127.0.0.1:5000'
      )
        .split(',')
        .map((x) => x.trim());
      callback(null, !origin || allowed.includes(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.disable('x-powered-by');
if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'img-src': ["'self'", 'data:', 'https:'],
        'connect-src': ["'self'", ...(process.env.CORS_ORIGINS || '').split(',').filter(Boolean)],
      },
    },
  }),
);
app.use((req, res, next) => {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  requestContext.run({ requestId }, next);
});
app.use(express.json({ limit: '32kb' }));
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests. Try again shortly.' },
  }),
);
app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' },
  }),
);
app.use(
  '/api/auth/forgot-password',
  rateLimit({
    windowMs: 15 * 60000,
    limit: 5,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many recovery requests. Try again later.' },
  }),
);
app.use(
  '/api/auth/confirm-forgot-password',
  rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many verification attempts. Try again later.' },
  }),
);
app.use(
  '/api/auth/register',
  rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many registrations. Try again later.' },
  }),
);
app.use(
  '/api/auth/confirm-registration',
  rateLimit({
    windowMs: 15 * 60000,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many verification attempts. Try again later.' },
  }),
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', clinicRoutes);
app.use('/api', doctorRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    project: 'QureFlow',
    database: 'dynamodb',
    ...(discoveryEnabled() ? { ...clinicIdentity(), discoveryVersion: 1 } : {}),
    timestamp: new Date().toISOString(),
  });
});
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Serve static frontend assets from dist (Unified single-port hosting)
if (discoveryEnabled() && process.env.NODE_ENV === 'development') {
  app.get('/downloads/qureflow-debug.apk', (_req, res) => {
    const apkPath = path.resolve(
      process.cwd(),
      process.cwd().endsWith('backend')
        ? '../artifacts/QureFlow-debug.apk'
        : 'artifacts/QureFlow-debug.apk',
    );
    res.download(apkPath, 'QureFlow-debug.apk', (error) => {
      if (error && !res.headersSent)
        res.status(404).json({ error: 'The Android APK has not been built yet.' });
    });
  });
}
app.use(express.static(distPath));

// Catch-all route to serve SPA frontend for any non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Centralized error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500,
    requestId = requestContext.getStore()?.requestId;
  if (status >= 500) console.error('[QureFlow]', { requestId, errorType: err.name || 'Error' });
  res.status(status).json({
    error:
      status >= 500
        ? 'The service could not complete this request. Please try again.'
        : err.message || 'Invalid request',
    code: err.code || 'REQUEST_FAILED',
    requestId,
  });
});

if (process.env.NODE_ENV !== 'test' && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  const httpServer = app.listen(PORT, () => {
    console.log(`[QureFlow Unified Server] Running at http://localhost:${PORT}`);
    console.log(`[QureFlow Unified Server] Frontend & Backend active on port ${PORT}`);
    console.log(
      `[QureFlow Unified Server] AWS Region: ${AWS_REGION}, DynamoDB: ${DYNAMODB_TABLE_NAME}`,
    );
    if (discoveryEnabled()) {
      const stopDiscovery = advertiseClinic(Number(PORT));
      httpServer.once('close', stopDiscovery);
      for (const signal of ['SIGINT', 'SIGTERM'] as const)
        process.once(signal, () => {
          stopDiscovery();
          httpServer.close(() => process.exit(0));
          setTimeout(() => process.exit(0), 1500).unref();
        });
    }
  });
}
