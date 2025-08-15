# Real-time Collaborative Editor Makefile
# Convenient commands for development and deployment

.PHONY: help setup dev start stop logs clean reset health install build

# Default target
help:
	@echo "Real-time Collaborative Editor"
	@echo ""
	@echo "Available commands:"
	@echo "  setup     - Copy .env.example to .env"
	@echo "  install   - Install dependencies for all services"
	@echo "  dev       - Start all services in development mode with logs"
	@echo "  start     - Start all services in background"
	@echo "  stop      - Stop all services"
	@echo "  logs      - Show logs from all services"
	@echo "  clean     - Stop services and remove volumes"
	@echo "  reset     - Clean everything and prune Docker system"
	@echo "  health    - Check health of all services"
	@echo "  build     - Build all Docker images"
	@echo "  jwt       - Generate JWT tokens for testing"

# Setup environment
setup:
	@echo "🔧 Setting up environment..."
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "✅ Environment file created (.env)"; \
		echo "📝 Please edit .env with your configuration"; \
	else \
		echo "⚠️  .env already exists"; \
	fi

# Install dependencies
install:
	@echo "📦 Installing dependencies for all services..."
	@cd frontend && npm install
	@cd server && npm install  
	@cd signaling && npm install
	@echo "✅ All dependencies installed"

# Development mode with logs
dev: setup
	@echo "🚀 Starting development environment..."
	docker-compose up --build

# Start services in background
start: setup
	@echo "🚀 Starting all services..."
	docker-compose up -d --build
	@echo "✅ All services started"
	@echo "🌐 Frontend: http://localhost:5173"
	@echo "🔌 WebSocket: ws://localhost:1234"
	@echo "📡 Signaling: ws://localhost:3001"

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	docker-compose down
	@echo "✅ All services stopped"

# Show logs
logs:
	@echo "📋 Showing logs from all services..."
	docker-compose logs -f

# Clean everything
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v --remove-orphans
	@echo "✅ Cleanup complete"

# Reset everything
reset: clean
	@echo "🔄 Resetting everything..."
	docker system prune -f
	@echo "✅ Reset complete"

# Health check
health:
	@echo "🏥 Checking service health..."
	@echo "WebSocket Server:"
	@curl -f http://localhost:1234/health 2>/dev/null || echo "❌ WebSocket server not healthy"
	@echo ""
	@echo "Signaling Server:"
	@curl -f http://localhost:3001/health 2>/dev/null || echo "❌ Signaling server not healthy"

# Build Docker images
build:
	@echo "🏗️  Building Docker images..."
	docker-compose build
	@echo "✅ Build complete"

# Generate JWT tokens
jwt:
	@echo "🔐 Generating JWT tokens..."
	node scripts/generate-jwt.js

# Run specific service
run-frontend:
	@echo "🎨 Starting frontend only..."
	cd frontend && npm run dev

run-server:
	@echo "🔌 Starting WebSocket server only..."
	cd server && npm run dev

run-signaling:
	@echo "📡 Starting signaling server only..."
	cd signaling && npm run dev

# Development without Docker
dev-local: setup
	@echo "🔧 Starting local development environment..."
	@echo "Starting MongoDB and Redis with Docker..."
	docker-compose up -d mongodb redis coturn
	@echo "✅ Infrastructure services started"
	@echo "💡 Now start the services manually:"
	@echo "   Terminal 1: make run-server"
	@echo "   Terminal 2: make run-signaling" 
	@echo "   Terminal 3: make run-frontend"

# Production deployment
deploy-prod:
	@echo "🚀 Deploying to production..."
	@if [ ! -f .env ]; then \
		echo "❌ .env file not found. Please create it first."; \
		exit 1; \
	fi
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
	@echo "✅ Production deployment complete"

# Backup data
backup:
	@echo "💾 Creating backup..."
	@mkdir -p backups/$(shell date +%Y%m%d_%H%M%S)
	docker run --rm -v realtime_yjs_data:/data -v $(PWD)/backups/$(shell date +%Y%m%d_%H%M%S):/backup busybox tar czf /backup/yjs-data.tar.gz -C /data .
	docker exec realtime-mongodb mongodump --out /tmp/backup
	docker cp realtime-mongodb:/tmp/backup backups/$(shell date +%Y%m%d_%H%M%S)/mongodb
	@echo "✅ Backup created in backups/$(shell date +%Y%m%d_%H%M%S)"

# Restore data
restore:
	@echo "📥 Available backups:"
	@ls -la backups/
	@echo "To restore: make restore-from BACKUP=YYYYMMDD_HHMMSS"

restore-from:
	@if [ -z "$(BACKUP)" ]; then \
		echo "❌ Please specify backup: make restore-from BACKUP=YYYYMMDD_HHMMSS"; \
		exit 1; \
	fi
	@echo "📥 Restoring from backup: $(BACKUP)"
	docker run --rm -v realtime_yjs_data:/data -v $(PWD)/backups/$(BACKUP):/backup busybox tar xzf /backup/yjs-data.tar.gz -C /data
	docker cp backups/$(BACKUP)/mongodb realtime-mongodb:/tmp/
	docker exec realtime-mongodb mongorestore /tmp/mongodb
	@echo "✅ Restore complete"
