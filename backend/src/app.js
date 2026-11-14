const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
try { require('dotenv').config(); } catch (e) {}

const { apiLimiter } = require('./middleware/rateLimiter.middleware');
const { errorHandler } = require('./middleware/errorHandler.middleware');

const datasetsRoutes = require('./routes/datasets.routes');
const subjectsRoutes = require('./routes/subjects.routes');
const recordingsRoutes = require('./routes/recordings.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const sessionsRoutes = require('./routes/sessions.routes');
const authRoutes = require('./routes/auth.routes');
const { getDistinctTasks } = require('./services/supabase.service');

const app = express();

// Security headers
app.use(helmet());

// CORS config
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error(`CORS policy: origin ${origin} not permitted`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limit
app.use('/api', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'NeuroGlove API is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    hardware: 'ESP32_DISCONNECTED_DEMO_PHASE',
  });
});

// Tasks endpoint
app.get('/api/research/tasks', async (req, res) => {
  try {
    const tasks = await getDistinctTasks();
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Routes
app.use('/api/research/datasets', datasetsRoutes);
app.use('/api/research/subjects', subjectsRoutes);
app.use('/api/research/recordings', recordingsRoutes);
app.use('/api/research/analytics', analyticsRoutes);
app.use('/api/research/sessions', sessionsRoutes);
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// Error middleware
app.use(errorHandler);

module.exports = app;
