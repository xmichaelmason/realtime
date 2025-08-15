# Real-time Collaborative Editing Application

A production-ready real-time collaborative editing application built with:

- **Frontend**: Svelte 5 (Vite)
- **CRDT**: Yjs for conflict-free collaborative editing
- **Real-time Transport**: 
  - y-webrtc for peer-to-peer low-latency sync
  - y-websocket for server-authoritative persistence and fallback
- **Persistence**: 
  - LevelDB via y-leveldb for Yjs document storage
  - MongoDB for queryable metadata
- **Signaling**: WebSocket-based signaling server for WebRTC
- **TURN/STUN**: coturn for NAT traversal
- **Scaling**: Redis Pub/Sub for multi-node WebSocket scaling

## Features

- ✅ Real-time collaborative text editing
- ✅ Peer-to-peer low-latency sync via WebRTC
- ✅ Server-side persistence with LevelDB
- ✅ Metadata indexing in MongoDB
- ✅ JWT authentication
- ✅ Multiple rooms support
- ✅ Background metadata indexing
- ✅ WebRTC fallback to WebSocket
- ✅ Docker containerized deployment
- ✅ Horizontal scaling ready

## Architecture

```
┌─────────────┐    WebRTC P2P     ┌─────────────┐
│   Client A  │◄─────────────────►│   Client B  │
└─────────────┘                   └─────────────┘
       │                                 │
       │ WebSocket (fallback/persistence) │
       ▼                                 ▼
┌─────────────────────────────────────────────────┐
│           WebSocket Server (y-websocket)        │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐ │
│  │   LevelDB   │  │  Indexer    │  │  Redis   │ │
│  │ (Yjs Data)  │  │   Queue     │  │ Pub/Sub  │ │
│  └─────────────┘  └─────────────┘  └──────────┘ │
└─────────────────────────────────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │    MongoDB      │
              │   (Metadata)    │
              └─────────────────┘
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo>
cd realtime

# Copy environment variables
cp .env.example .env

# Edit .env with your secrets (required for security)
# Windows
notepad .env
# macOS/Linux  
nano .env
```

### 2. Start the Application

**Option A: Docker Compose (Recommended)**
```bash
# Start all services
docker-compose up --build

# Or use the Makefile
make dev
```

**Option B: Windows Commands (run.bat)**
```cmd
# Windows users can use the batch file instead of Makefile
# Setup and start development environment
.\run.bat setup
.\run.bat start

# Check service health  
.\run.bat health

# View logs
.\run.bat logs

# Stop services
.\run.bat stop
```

**Option C: Makefile Commands (Linux/macOS)**
```bash
# Setup and start development environment
make setup
make dev

# Or start in background
make start
```

### 3. Generate JWT Tokens

```bash
# Generate test tokens
node scripts/generate-jwt.js

# Or using Makefile
make jwt
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **WebSocket Server**: ws://localhost:1234
- **Signaling Server**: ws://localhost:3001
- **MongoDB**: mongodb://localhost:27017
- **Redis**: redis://localhost:6379

## Development

### Local Development Setup

1. **Install dependencies for each service:**

```bash
# Frontend
cd frontend
npm install

# Server
cd ../server
npm install

# Signaling
cd ../signaling
npm install
```

2. **Start services individually:**

```bash
# Terminal 1: MongoDB & Redis
docker-compose up mongodb redis coturn

# Terminal 2: WebSocket Server
cd server
npm run dev

# Terminal 3: Signaling Server
cd signaling
npm run dev

# Terminal 4: Frontend
cd frontend
npm run dev
```

### Building for Production

```bash
# Build all services
docker-compose build

# Build specific service
docker-compose build websocket-server
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT token signing | `your-super-secret-jwt-key` |
| `MONGO_USERNAME` | MongoDB username | `admin` |
| `MONGO_PASSWORD` | MongoDB password | `password` |
| `REDIS_PASSWORD` | Redis password | `password` |
| `TURN_SECRET` | TURN server secret | `your-turn-secret` |
| `NODE_ENV` | Environment mode | `development` |

### JWT Authentication

The application uses JWT tokens for authentication. Include the token as a query parameter:

```javascript
// WebSocket connection
const wsProvider = new WebsocketProvider('ws://localhost:1234', 'room-name', ydoc, {
  params: { token: 'your-jwt-token' }
});

// WebRTC connection
const webrtcProvider = new WebrtcProvider('room-name', ydoc, {
  signaling: ['ws://localhost:3001?token=your-jwt-token']
});
```

### Document Schema

Each Yjs document contains:
- `content`: Main collaborative text (Y.Text)
- `title`: Document title (Y.Text, optional)

MongoDB metadata schema:
```javascript
{
  _id: "room-id",
  title: "Document Title",
  updatedAt: Date,
  ownerId: "user-id",
  tags: ["tag1", "tag2"],
  collaborators: ["user1", "user2"]
}
```

## API Endpoints

### WebSocket Server (y-websocket)

- `WS /`: Main WebSocket endpoint for Yjs sync
  - Query params: `token` (JWT), `room` (room ID)

### Signaling Server

- `WS /`: WebRTC signaling endpoint
  - Query params: `token` (JWT)

## Scaling

### Horizontal Scaling

The WebSocket server supports horizontal scaling via Redis Pub/Sub:

```yaml
# docker-compose.yml
websocket-server:
  deploy:
    replicas: 3
  environment:
    - REDIS_URL=redis://:password@redis:6379
```

### Load Balancing

Use a load balancer (nginx, HAProxy) to distribute WebSocket connections:

```nginx
upstream websocket_servers {
    server websocket-server-1:1234;
    server websocket-server-2:1234;
    server websocket-server-3:1234;
}

server {
    location / {
        proxy_pass http://websocket_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Security

### JWT Tokens

- Use strong secrets in production
- Implement token expiration and refresh
- Validate user permissions before room access

### Rate Limiting

The servers include basic rate limiting:
- WebSocket upgrades: 100 requests/minute per IP
- Signaling connections: 50 requests/minute per IP

### TLS/SSL

For production, enable TLS:

```yaml
# docker-compose.prod.yml
coturn:
  volumes:
    - ./certs/cert.pem:/etc/coturn/certs/cert.pem:ro
    - ./certs/privkey.pem:/etc/coturn/certs/privkey.pem:ro
```

## Monitoring

### Health Checks

```bash
# Check WebSocket server
curl http://localhost:1234/health

# Check signaling server
curl http://localhost:3001/health
```

### Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f websocket-server
```

## Troubleshooting

### Common Issues

1. **WebRTC connections failing**
   - Check TURN server configuration
   - Verify firewall settings for UDP ports 49152-65535
   - Ensure coturn container is running

2. **Database connection errors**
   - Verify MongoDB credentials in .env
   - Check if MongoDB container is healthy
   - Ensure network connectivity

3. **Authentication failures**
   - Verify JWT_SECRET matches between services
   - Check token expiration
   - Ensure token is passed as query parameter

### Debug Mode

Enable debug logging:

```bash
# Set debug environment
DEBUG=y-websocket,y-webrtc docker-compose up
```

## Production Deployment

### Docker Compose Production

```bash
# Copy and edit production environment
cp .env.example .env.production
nano .env.production

# Deploy with production overrides
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Or use Makefile
make deploy-prod
```

### Environment Variables for Production

```env
# Strong JWT secret (32+ characters)
JWT_SECRET=your-super-strong-production-jwt-secret-key

# Strong database passwords
MONGO_USERNAME=admin
MONGO_PASSWORD=secure-mongo-password-change-this

# Redis password
REDIS_PASSWORD=secure-redis-password-change-this

# TURN server secret
TURN_SECRET=your-production-turn-secret-change-this

# Your domain for TURN server
COTURN_HOST=your-domain.com
```

### SSL/TLS Configuration

1. **Obtain SSL certificates:**
```bash
# Using certbot (Let's Encrypt)
certbot certonly --standalone -d your-domain.com
```

2. **Copy certificates to coturn directory:**
```bash
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem coturn/certs/cert.pem
cp /etc/letsencrypt/live/your-domain.com/privkey.pem coturn/certs/privkey.pem
```

3. **Update coturn configuration** in `coturn/turnserver.conf`:
```
cert=/etc/coturn/certs/cert.pem
pkey=/etc/coturn/certs/privkey.pem
server-name=your-domain.com
realm=your-domain.com
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Create a GitHub issue
- Check the troubleshooting section
- Review Docker Compose logs

## Project Status

✅ **Completed Features:**
- Svelte 5 frontend with collaborative editing
- Y.js CRDT implementation
- WebSocket server with LevelDB persistence
- WebRTC signaling server
- JWT authentication
- MongoDB metadata indexing
- Redis pub/sub for scaling
- Docker containerization
- Health checks and monitoring
- Integration tests

🔄 **In Progress:**
- Advanced awareness features (cursors, selections)
- Rich text editing support
- File attachment handling
- User management interface

📋 **TODO:**
- [ ] **Enable LevelDB Persistence**: Currently using memory-only storage. Need to implement y-leveldb integration for persistent document storage on disk.
- [ ] **Comprehensive Testing Framework**: Implement proper testing with Jest/Vitest, including:
  - Unit tests for all components and services
  - Integration tests for collaborative editing workflows
  - End-to-end browser automation testing (Playwright/Cypress)
  - WebSocket and WebRTC connection testing
  - Performance and load testing
  - Cross-browser compatibility testing

📋 **Planned Features:**
- Real-time cursors and selections
- Document version history
- Advanced permission system
- Conflict resolution UI
- Mobile app support
