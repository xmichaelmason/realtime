# TURN Server Setup Instructions

## Overview
This directory contains the configuration for the coturn TURN/STUN server, which is essential for WebRTC connections to work behind NATs and firewalls.

## Files
- `turnserver.conf` - Main coturn configuration file
- `certs/` - Directory for SSL/TLS certificates (for production)

## Development Setup

For development, the basic configuration in `turnserver.conf` should work out of the box with Docker Compose. The server will run on:

- **STUN/TURN UDP**: Port 3478
- **TURN TCP**: Port 3478  
- **TURNS (secure)**: Port 5349
- **Relay ports**: 49152-65535 (UDP)

## Production Setup

### 1. SSL/TLS Certificates

For production, you'll need valid SSL certificates. You can obtain them from:

- Let's Encrypt (free): `certbot certonly --standalone -d your-domain.com`
- Commercial CA
- Self-signed (not recommended for production)

Place the certificates in the `certs/` directory:
```bash
# Copy your certificates
cp /path/to/cert.pem ./certs/
cp /path/to/privkey.pem ./certs/
```

Then uncomment and update these lines in `turnserver.conf`:
```
cert=/etc/coturn/certs/cert.pem
pkey=/etc/coturn/certs/privkey.pem
```

### 2. Domain Configuration

Update the server name in `turnserver.conf`:
```
server-name=your-domain.com
realm=your-domain.com
```

### 3. Firewall Configuration

Ensure these ports are open in your firewall:

```bash
# UFW (Ubuntu)
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 49152:65535/udp

# iptables
iptables -A INPUT -p udp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
iptables -A INPUT -p tcp --dport 5349 -j ACCEPT
iptables -A INPUT -p udp --dport 49152:65535 -j ACCEPT
```

### 4. Security Hardening

For production, consider:

1. **Change the static auth secret** in both `turnserver.conf` and your environment variables
2. **Enable user database** for better user management
3. **Configure IP restrictions** to prevent abuse
4. **Set up monitoring** and log analysis
5. **Use a reverse proxy** with rate limiting

### 5. Testing the TURN Server

You can test your TURN server using online tools:

- [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
- [WebRTC Troubleshooter](https://test.webrtc.org/)

Or use the coturn test utilities:
```bash
# Test STUN
turnutils_stunclient your-domain.com

# Test TURN
turnutils_uclient -t -T -u username -w password your-domain.com
```

### 6. Environment Variables

Make sure to update your `.env` file with the production values:

```env
TURN_SECRET=your-production-turn-secret-change-this
COTURN_HOST=your-domain.com
```

## Monitoring

Monitor coturn logs for issues:

```bash
# View logs
docker-compose logs coturn

# Follow logs
docker-compose logs -f coturn
```

Common issues:
- **Permission denied**: Check certificate file permissions
- **Port binding errors**: Ensure ports aren't already in use
- **Authentication failures**: Verify the TURN secret matches between services

## Alternative Deployment

If you prefer to run coturn on the host system instead of Docker:

```bash
# Install coturn
sudo apt-get install coturn

# Copy configuration
sudo cp turnserver.conf /etc/turnserver.conf

# Enable and start
sudo systemctl enable coturn
sudo systemctl start coturn
```

## Scaling

For high-traffic production deployments:

1. **Multiple TURN servers**: Deploy multiple coturn instances behind a load balancer
2. **Geographic distribution**: Place TURN servers closer to your users
3. **Database backend**: Use MongoDB or Redis for user management
4. **Monitoring**: Set up Prometheus/Grafana for coturn metrics

## Troubleshooting

### Common WebRTC Connection Issues

1. **No ICE candidates**: Check if STUN server is reachable
2. **Connection timeout**: Verify TURN server credentials
3. **One-way audio/video**: Usually a firewall/NAT issue
4. **High latency**: Consider geographic proximity of TURN servers

### Debug Commands

```bash
# Check if ports are listening
netstat -tulnp | grep 3478

# Test connectivity
telnet your-domain.com 3478

# Verify SSL certificate
openssl s_client -connect your-domain.com:5349
```
