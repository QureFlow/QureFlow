import express from 'express';
import cors from 'cors';
import path from 'path';
import { PORT, AWS_REGION, DYNAMODB_TABLE_NAME } from './config/aws.js';
import authRoutes from './routes/authRoutes.js';
import clinicRoutes from './routes/clinicRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import tokenRoutes from './routes/tokenRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';

// Resolve frontend dist directory (support running from root or backend folder)
const distPath = path.resolve(process.cwd(), process.cwd().endsWith('backend') ? '../dist' : 'dist');

export const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', clinicRoutes);
app.use('/api', doctorRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/tokens', tokenRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    project: 'QureFlow',
    region: AWS_REGION,
    dynamoDbTable: DYNAMODB_TABLE_NAME,
    timestamp: new Date().toISOString(),
  });
});

// Serve static frontend assets from dist (Unified single-port hosting)
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
  console.error('[QureFlow Server Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[QureFlow Unified Server] Running at http://localhost:${PORT}`);
    console.log(`[QureFlow Unified Server] Frontend & Backend active on port ${PORT}`);
    console.log(`[QureFlow Unified Server] AWS Region: ${AWS_REGION}, DynamoDB: ${DYNAMODB_TABLE_NAME}`);
  });
}
