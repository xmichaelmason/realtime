import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

// Configuration
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const TURN_SECRET = process.env.TURN_SECRET || 'your-turn-server-secret-789';
const COTURN_HOST = process.env.COTURN_HOST || 'localhost';

// Store active rooms and connections
const rooms = new Map();
const connections = new Map();

function authenticateConnection(request) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

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
      } catch (e) {
        throw new Error('Invalid demo token payload');
      }
    } else {
      // For real tokens, verify with JWT secret
      decoded = jwt.verify(token, JWT_SECRET);
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
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

function generateTurnCredentials() {
  const username = Math.floor(Date.now() / 1000) + 24 * 3600; // Valid for 24 hours
  const credential = crypto
    .createHmac('sha1', TURN_SECRET)
    .update(username.toString())
    .digest('base64');

  return { username: username.toString(), credential };
}

function getIceServers() {
  const turnCreds = generateTurnCredentials();
  
  return [
    // Public STUN servers (backup)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Our TURN server
    {
      urls: `turn:${COTURN_HOST}:3478`,
      username: turnCreds.username,
      credential: turnCreds.credential
    },
    {
      urls: `turns:${COTURN_HOST}:5349`,
      username: turnCreds.username,
      credential: turnCreds.credential
    }
  ];
}

function handleSignalingMessage(ws, message) {
  try {
    const data = JSON.parse(message);
    const { type, topics, topic, data: messageData } = data;

    switch (type) {
      // y-webrtc signaling protocol messages
      case 'subscribe':
        handleSubscribe(ws, topics || [topic]);
        break;

      case 'unsubscribe':
        handleUnsubscribe(ws, topics || [topic]);
        break;

      case 'publish':
        handlePublish(ws, topic, messageData);
        break;

      case 'ping':
        handlePing(ws);
        break;

      // Custom signaling messages for additional features
      case 'join-room':
        handleJoinRoom(ws, data.room);
        break;

      case 'signal':
        handleSignal(ws, data.room, data.target, data.payload);
        break;

      case 'leave-room':
        handleLeaveRoom(ws, data.room);
        break;

      default:
        console.warn(`⚠️ Unknown signaling message type: ${type}`);
    }
  } catch (error) {
    console.error('❌ Error handling signaling message:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid message format'
    }));
  }
}

// y-webrtc signaling protocol handlers
function handleSubscribe(ws, topics) {
  if (!Array.isArray(topics)) {
    topics = [topics];
  }

  // Initialize subscriptions if not exists
  if (!ws.subscriptions) {
    ws.subscriptions = new Set();
  }

  topics.forEach(topic => {
    if (topic) {
      ws.subscriptions.add(topic);
      
      // Add to room-based tracking
      if (!rooms.has(topic)) {
        rooms.set(topic, new Set());
      }
      rooms.get(topic).add(ws);
      
      console.log(`📡 User ${ws.user.name} subscribed to topic: ${topic}`);
    }
  });

  // Send acknowledgment
  ws.send(JSON.stringify({
    type: 'subscribed',
    topics: topics
  }));
}

function handleUnsubscribe(ws, topics) {
  if (!Array.isArray(topics)) {
    topics = [topics];
  }

  if (!ws.subscriptions) {
    return;
  }

  topics.forEach(topic => {
    if (topic && ws.subscriptions.has(topic)) {
      ws.subscriptions.delete(topic);
      
      // Remove from room-based tracking
      const room = rooms.get(topic);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(topic);
          console.log(`🗑️ Cleaned up empty topic: ${topic}`);
        }
      }
      
      console.log(`📡 User ${ws.user.name} unsubscribed from topic: ${topic}`);
    }
  });
}

function handlePublish(ws, topic, data) {
  if (!topic || !data) {
    return;
  }

  console.log(`📤 Publishing to topic ${topic} from ${ws.user.name}`);

  // Get all subscribers to this topic
  const subscribers = rooms.get(topic);
  if (!subscribers) {
    return;
  }

  // Broadcast to all subscribers except the sender
  const message = JSON.stringify({
    type: 'publish',
    topic: topic,
    data: data
  });

  subscribers.forEach(subscriber => {
    if (subscriber !== ws && subscriber.readyState === subscriber.OPEN) {
      subscriber.send(message);
    }
  });
}

function handlePing(ws) {
  // Respond with pong
  ws.send(JSON.stringify({
    type: 'pong'
  }));
}

function handleJoinRoom(ws, roomId) {
  if (!roomId) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room ID is required'
    }));
    return;
  }

  // Leave previous room if any
  if (ws.currentRoom) {
    handleLeaveRoom(ws, ws.currentRoom);
  }

  // Join new room
  ws.currentRoom = roomId;
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  rooms.get(roomId).add(ws);

  console.log(`🏠 User ${ws.user.name} joined signaling room: ${roomId}`);

  // Send ICE server configuration
  ws.send(JSON.stringify({
    type: 'ice-servers',
    iceServers: getIceServers()
  }));

  // Notify other peers in the room
  const roomPeers = rooms.get(roomId);
  roomPeers.forEach(peer => {
    if (peer !== ws && peer.readyState === peer.OPEN) {
      peer.send(JSON.stringify({
        type: 'peer-joined',
        peerId: ws.user.id,
        peerName: ws.user.name
      }));
    }
  });

  // Send list of existing peers to the new connection
  const existingPeers = Array.from(roomPeers)
    .filter(peer => peer !== ws)
    .map(peer => ({
      id: peer.user.id,
      name: peer.user.name
    }));

  ws.send(JSON.stringify({
    type: 'existing-peers',
    peers: existingPeers
  }));
}

function handleSignal(ws, roomId, targetId, payload) {
  if (!roomId || !targetId || !payload) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Invalid signal parameters'
    }));
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Room not found'
    }));
    return;
  }

  // Find target peer
  const targetPeer = Array.from(room).find(peer => peer.user.id === targetId);
  
  if (!targetPeer) {
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Target peer not found'
    }));
    return;
  }

  // Forward the signal to the target peer
  if (targetPeer.readyState === targetPeer.OPEN) {
    targetPeer.send(JSON.stringify({
      type: 'signal',
      from: ws.user.id,
      fromName: ws.user.name,
      payload
    }));
  }
}

function handleLeaveRoom(ws, roomId) {
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (room) {
    room.delete(ws);
    
    // Notify other peers
    room.forEach(peer => {
      if (peer.readyState === peer.OPEN) {
        peer.send(JSON.stringify({
          type: 'peer-left',
          peerId: ws.user.id,
          peerName: ws.user.name
        }));
      }
    });

    // Clean up empty rooms
    if (room.size === 0) {
      rooms.delete(roomId);
      console.log(`🗑️ Cleaned up empty room: ${roomId}`);
    }
  }

  ws.currentRoom = null;
  console.log(`🚪 User ${ws.user.name} left signaling room: ${roomId}`);
}

function setupSignalingServer() {
  console.log('🚀 Starting WebRTC Signaling Server...');

  // Create Express app for health checks
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      activeRooms: rooms.size,
      activeConnections: connections.size
    });
  });

  // Stats endpoint
  app.get('/stats', (req, res) => {
    const roomStats = Array.from(rooms.entries()).map(([roomId, peers]) => ({
      roomId,
      peerCount: peers.size
    }));

    res.json({
      totalRooms: rooms.size,
      totalConnections: connections.size,
      rooms: roomStats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    });
  });

  // Create HTTP server
  const server = app.listen(PORT, () => {
    console.log(`🌐 HTTP server listening on port ${PORT}`);
  });

  // Create WebSocket server (no rate limiting on upgrades)
  const wss = new WebSocketServer({ 
    server,
    path: '/',
    clientTracking: true
  });

  console.log(`🔌 WebRTC signaling server ready on ws://localhost:${PORT}`);

  wss.on('connection', (ws, request) => {
    try {
      // Authenticate the connection
      const user = authenticateConnection(request);
      console.log(`🔗 Signaling connection from: ${user.name} (${user.id})`);

      ws.user = user;
      connections.set(ws, user);

      // Handle incoming messages
      ws.on('message', (message) => {
        handleSignalingMessage(ws, message.toString());
      });

      // Handle connection close
      ws.on('close', () => {
        // Clean up traditional room membership
        if (ws.currentRoom) {
          handleLeaveRoom(ws, ws.currentRoom);
        }
        
        // Clean up topic subscriptions
        if (ws.subscriptions) {
          ws.subscriptions.forEach(topic => {
            const room = rooms.get(topic);
            if (room) {
              room.delete(ws);
              if (room.size === 0) {
                rooms.delete(topic);
                console.log(`🗑️ Cleaned up empty topic: ${topic}`);
              }
            }
          });
        }
        
        connections.delete(ws);
        console.log(`🔌 Signaling disconnection: ${user.name}`);
      });

      ws.on('error', (error) => {
        console.error(`❌ Signaling WebSocket error for ${user.name}:`, error);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to signaling server',
        userId: user.id
      }));

    } catch (error) {
      console.error('❌ Signaling authentication failed:', error.message);
      ws.close(1008, error.message); // Policy violation
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down signaling server...');
    
    wss.clients.forEach(ws => {
      ws.close(1001, 'Server shutting down');
    });
    
    server.close(() => {
      console.log('✅ Signaling server shutdown complete');
      process.exit(0);
    });
  });

  return { server, wss };
}

// Start the signaling server
setupSignalingServer();
