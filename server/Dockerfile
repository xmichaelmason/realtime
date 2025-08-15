# WebSocket Server Dockerfile
FROM node:18-alpine

WORKDIR /app

# Create data directory for LevelDB
RUN mkdir -p /app/data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY src/ ./src/

# Expose WebSocket port
EXPOSE 1234

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:1234/health || exit 1

# Start the server
CMD ["npm", "start"]
