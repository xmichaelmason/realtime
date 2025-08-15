import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { createClient } from 'redis';
// import LevelDBPersistence from 'y-leveldb';
import * as Y from 'yjs';
import { createIndexingQueue } from './indexer.js';
import { setupRedisAwareness } from './redis-awareness.js';

// Configuration
const PORT = process.env.PORT || 1234;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:password@localhost:27017/realtime?authSource=admin';
const REDIS_URL = process.env.REDIS_URL || 'redis://:password@localhost:6379';
// Initialize components
let mongoClient;
let redisClient;
let persistence;
let indexingQueue;

async function initializeServices() {
  console.log('🚀 Initializing Real-time Collaboration Server...');

  try {
    // Initialize MongoDB
    console.log('📦 Connecting to MongoDB...');
    mongoClient = new MongoClient(MONGO_URI);
    await mongoClient.connect();
    await mongoClient.db().admin().ping();
    console.log('✅ MongoDB connected successfully');

    // Initialize Redis
    console.log('📦 Connecting to Redis...');
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    await redisClient.connect();
    console.log('✅ Redis connected successfully');

    // Initialize LevelDB persistence (disabled for now)
    console.log('📦 LevelDB persistence disabled - using memory only');
    // persistence = new LevelDBPersistence(LEVELDB_PATH);
    // console.log('✅ LevelDB persistence initialized');

    // Initialize indexing queue
    console.log('📦 Setting up document indexing queue...');
    indexingQueue = createIndexingQueue(mongoClient, null); // no persistence for now
    await indexingQueue.start();
    console.log('✅ Document indexing queue started');

  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

function authenticateConnection(request) {
  try {
    const token = request.query?.token || new URL(request.url || '', 'http://localhost').searchParams.get('token');

    console.log('🎫 Authenticating with token:', token ? `${token.substring(0, 50)}...` : 'No token');

    if (!token) {
      throw new Error('No authentication token provided');
    }

    let decoded;
    
    // Handle demo tokens (for development)
    if (token.endsWith('.demo-signature')) {
      // For demo tokens, just decode the payload without verification
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid demo token format');
      }
      
      try {
        const payload = JSON.parse(atob(parts[1]));
        decoded = payload;
        console.log('🎫 Demo token decoded:', decoded);
      } catch (e) {
        throw new Error('Invalid demo token payload');
      }
    } else {
      // For real tokens, verify with JWT secret
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('🎫 JWT token verified:', decoded);
    }
    
    if (!decoded.id || !decoded.name) {
      throw new Error('Invalid token payload - missing required fields');
    }

    return {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    console.error('❌ Authentication error:', error);
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

function setupYjsConnections(wss) {
  // Store for tracking active documents
  const activeDocuments = new Map();

  wss.on('connection', async (ws, request) => {
    console.log(`🔗 WebSocket connection established`);
    
    // User was already authenticated during upgrade
    const user = request.user;
    console.log(`🔗 User connected: ${user.name} (${user.id})`);

    // Extract room from URL path
    const url = new URL(request.url, `http://${request.headers.host}`);
    const room = url.pathname.slice(1) || 'default'; // Remove leading slash

    console.log(`📂 User ${user.name} joining room: ${room}`);

    // Set user info on the WebSocket
    ws.user = user;
    ws.room = room;

    // Setup standard y-websocket connection
    const docName = `room:${room}`;
    
    // Setup the connection and then manually hook into the document
    setupWSConnection(ws, request, { docName });
    
    // After a short delay, find and hook into the document created by y-websocket
    setTimeout(async () => {
      try {
        // y-websocket stores documents in a global docs map
        const utils = await import('y-websocket/bin/utils');
        const ydoc = utils.docs.get(docName);
        
        if (ydoc && !activeDocuments.has(docName)) {
          console.log(`📄 Document found and hooked: ${docName}`);
          activeDocuments.set(docName, ydoc);
        
        // Register with indexing queue
        indexingQueue.registerDocument(room, ydoc);
        
        // Set up update listener
        ydoc.on('update', (update, origin) => {
          console.log(`📝 Document updated: ${room} by ${user.name}`);
          indexingQueue.enqueue(room, user.id);
        });
        
        // Initial indexing
        console.log(`📋 Initial indexing for: ${room}`);
        indexingQueue.enqueue(room, user.id);
      } else if (ydoc) {
        console.log(`📄 Document already tracked: ${docName}`);
        // Still trigger indexing for this user's connection
        setTimeout(() => {
          console.log(`📋 User-triggered indexing for: ${room}`);
          indexingQueue.enqueue(room, user.id);
        }, 1000);
      } else {
        console.log(`⚠️ Document not found for: ${docName}`);
      }
      } catch (error) {
        console.error(`❌ Error accessing y-websocket docs:`, error);
      }
    }, 500);

    // Setup Redis awareness for multi-node scaling
    if (redisClient) {
      setupRedisAwareness(ws, room, redisClient);
    }

    // Handle connection close
    ws.on('close', () => {
      console.log(`🔌 User disconnected: ${user.name} from room: ${room}`);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for user ${user.name}:`, error);
    });
  });
}

async function startServer() {
  await initializeServices();

  // Create Express app for health checks and HTTP endpoints
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        mongodb: mongoClient?.topology?.isConnected() || false,
        redis: redisClient?.isOpen || false,
        leveldb: !!persistence
      }
    });
  });

  // Stats endpoint
  app.get('/stats', async (req, res) => {
    try {
      const db = mongoClient.db();
      const totalDocs = await db.collection('docs').countDocuments();
      
      res.json({
        totalDocuments: totalDocs,
        activeConnections: wss.clients.size,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create HTTP server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP server listening on 0.0.0.0:${PORT}`);
  });

  // Handle upgrade requests explicitly
  server.on('upgrade', (request, socket, head) => {
    console.log('🔄 WebSocket upgrade request received');
    console.log('📍 Upgrade URL:', request.url);
  });

  // Create WebSocket server with authentication during upgrade
  const wss = new WebSocketServer({ 
    server,
    clientTracking: true,
    verifyClient: (info) => {
      console.log('🔍 Verifying WebSocket client...');
      console.log('📍 Origin:', info.origin);
      console.log('📍 URL:', info.req.url);
      console.log('📍 Headers:', info.req.headers);
      
      try {
        const user = authenticateConnection(info.req);
        console.log(`✅ Authentication successful for: ${user.name} (${user.id})`);
        
        // Store user info on the request for later use
        info.req.user = user;
        return true;
      } catch (error) {
        console.error('❌ Authentication failed during upgrade:', error.message);
        return false;
      }
    }
  });

  console.log(`🔌 WebSocket server ready on ws://0.0.0.0:${PORT}`);

  // Setup Y.js connections
  setupYjsConnections(wss);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    
    wss.clients.forEach(ws => {
      ws.close(1001, 'Server shutting down');
    });
    
    await indexingQueue?.stop();
    await redisClient?.quit();
    await mongoClient?.close();
    
    server.close(() => {
      console.log('✅ Server shutdown complete');
      process.exit(0);
    });
  });

  return { server, wss };
}

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
