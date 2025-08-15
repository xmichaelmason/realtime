export function setupRedisAwareness(ws, room, redisClient) {
  const channel = `awareness:${room}`;
  const subscriber = redisClient.duplicate();
  let isSubscribed = false;

  async function initializeSubscriber() {
    try {
      await subscriber.connect();
      await subscriber.subscribe(channel, (message) => {
        try {
          const data = JSON.parse(message);
          
          // Don't send awareness updates back to the originating connection
          if (data.origin === ws.user?.id) return;
          
          // Forward awareness updates to this WebSocket connection
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
              type: 'awareness',
              awareness: data.awareness
            }));
          }
        } catch (error) {
          console.error('❌ Error processing awareness message:', error);
        }
      });
      
      isSubscribed = true;
      console.log(`📡 Subscribed to awareness channel: ${channel}`);
      
    } catch (error) {
      console.error(`❌ Failed to setup Redis awareness for room ${room}:`, error);
    }
  }

  // Handle awareness updates from this WebSocket
  const originalSend = ws.send.bind(ws);
  ws.send = function(data) {
    // Check if this is an awareness update
    try {
      const message = JSON.parse(data);
      if (message.type === 'awareness') {
        // Broadcast to other nodes via Redis
        redisClient.publish(channel, JSON.stringify({
          origin: ws.user?.id,
          awareness: message.awareness,
          timestamp: Date.now()
        })).catch(error => {
          console.error('❌ Failed to publish awareness update:', error);
        });
      }
    } catch (error) {
      // Not JSON or not an awareness message, ignore
    }
    
    // Send the original message
    originalSend(data);
  };

  // Setup the subscriber
  initializeSubscriber();

  // Cleanup on WebSocket close
  ws.on('close', async () => {
    if (isSubscribed) {
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
        console.log(`📡 Unsubscribed from awareness channel: ${channel}`);
      } catch (error) {
        console.error('❌ Error cleaning up Redis awareness:', error);
      }
    }
  });

  return {
    cleanup: async () => {
      if (isSubscribed) {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      }
    }
  };
}
