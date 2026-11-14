/**
 * NeuroGlove Backend API Server
 * 
 * Supports full Express.js application when node_modules are installed,
 * and includes a native built-in Node.js HTTP engine fallback so it runs
 * immediately in all environments without dependency friction.
 */

try { require('dotenv').config(); } catch (e) {}

const PORT = parseInt(process.env.PORT, 10) || 3001;

// Try loading full Express app
let app = null;
try {
  app = require('./app');
} catch (e) {
  // Fallback to native HTTP server
}

if (app && typeof app.listen === 'function') {
  const server = app.listen(PORT, () => {
    printBanner('Express.js Engine');
  });

  server.on('error', (err) => {
    console.error('[NeuroGlove Backend] Server error:', err);
    process.exit(1);
  });
} else {
  // Built-in zero-dependency HTTP server
  const http = require('http');
  const url = require('url');
  const supabaseService = require('./services/supabase.service');
  const analyticsService = require('./services/analytics.service');

  function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Content-Type', 'application/json');
  }

  const server = http.createServer(async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;
    const query = parsed.query || {};

    try {
      // 1. Health
      if (pathname === '/api/health') {
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: true,
          message: 'NeuroGlove API is operational',
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          version: '1.0.0',
          engine: 'Native Node.js HTTP Engine',
          hardware: 'ESP32_DISCONNECTED_DEMO_PHASE',
        }));
      }

      // 2. Datasets
      if (pathname === '/api/research/datasets') {
        const datasets = await supabaseService.getDatasets();
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, data: datasets }));
      }

      // 3. Subjects
      if (pathname === '/api/research/subjects') {
        const limit = parseInt(query.limit, 10) || 20;
        const page = parseInt(query.page, 10) || 1;
        const offset = (page - 1) * limit;
        const { data, count } = await supabaseService.getSubjects({ limit, offset });
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: true,
          data,
          pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
        }));
      }

      // 4. Tasks
      if (pathname === '/api/research/tasks') {
        const tasks = await supabaseService.getDistinctTasks();
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, data: tasks }));
      }

      // 5. Recordings & Samples
      const recSamplesMatch = pathname.match(/^\/api\/research\/recordings\/([^/]+)\/samples$/);
      if (recSamplesMatch) {
        const recordingId = recSamplesMatch[1];
        const limit = parseInt(query.limit, 10) || 300;
        const page = parseInt(query.page, 10) || 1;
        const offset = (page - 1) * limit;
        const { data, count } = await supabaseService.getSensorReadings(recordingId, { limit, offset });
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: true,
          data,
          pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
        }));
      }

      const recSingleMatch = pathname.match(/^\/api\/research\/recordings\/([^/]+)$/);
      if (recSingleMatch && !pathname.includes('samples')) {
        const recordingId = recSingleMatch[1];
        const rec = await supabaseService.getRecordingById(recordingId);
        if (!rec) {
          res.writeHead(404);
          return res.end(JSON.stringify({ success: false, message: 'Recording not found' }));
        }
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, data: rec }));
      }

      if (pathname === '/api/research/recordings') {
        const limit = parseInt(query.limit, 10) || 20;
        const page = parseInt(query.page, 10) || 1;
        const offset = (page - 1) * limit;
        const { data, count } = await supabaseService.getRecordings({
          task: query.task,
          subjectId: query.subjectId,
          limit,
          offset,
        });
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: true,
          data,
          pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
        }));
      }

      // 6. Analytics
      const analyticsMatch = pathname.match(/^\/api\/research\/analytics\/([^/]+)$/);
      if (analyticsMatch) {
        const recordingId = analyticsMatch[1];
        const analytics = await analyticsService.getOrComputeAnalytics(recordingId);
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, data: analytics }));
      }

      // 7. Sessions
      if (pathname === '/api/research/sessions') {
        const limit = parseInt(query.limit, 10) || 20;
        const page = parseInt(query.page, 10) || 1;
        const offset = (page - 1) * limit;
        const { data, count } = await supabaseService.getSessions({ limit, offset });
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: true,
          data,
          pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
        }));
      }

      // 8. Auth
      if (pathname === '/api/auth/me') {
        const profile = await supabaseService.getProfile('demo-patient-001');
        res.writeHead(200);
        return res.end(JSON.stringify({
          success: true,
          data: {
            id: 'demo-patient-001',
            email: 'demo@neuroglove.app',
            profile,
          }
        }));
      }

      // 404
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, message: `Route ${pathname} not found` }));
    } catch (err) {
      console.error('[API Error]', err);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, message: err.message || 'Internal server error' }));
    }
  });

  server.listen(PORT, () => {
    printBanner('Zero-Dependency HTTP Engine');
  });

  server.on('error', (err) => {
    console.error('[NeuroGlove Backend] Server error:', err);
    process.exit(1);
  });
}

function printBanner(engineName) {
  console.log(`\n=================================================`);
  console.log(`🧠 NeuroGlove Research API Server`);
  console.log(`=================================================`);
  console.log(`Engine:      ${engineName}`);
  console.log(`Port:        ${PORT}`);
  console.log(`Health:      http://localhost:${PORT}/api/health`);
  console.log(`Datasets:    http://localhost:${PORT}/api/research/datasets`);
  console.log(`Recordings:  http://localhost:${PORT}/api/research/recordings`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Supabase:    ${process.env.SUPABASE_URL ? 'Configured' : 'Running in fallback mock data mode'}`);
  console.log(`=================================================\n`);
}
