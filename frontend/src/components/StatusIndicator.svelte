<script>
  export let status = { webrtc: 'disconnected', websocket: 'disconnected', connectedPeers: 0 };

  function getStatusColor(state) {
    switch (state) {
      case 'connected': return '#10b981';
      case 'connecting': return '#f59e0b';
      case 'disconnected': return '#ef4444';
      default: return '#6b7280';
    }
  }

  function getStatusText(state) {
    switch (state) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting';
      case 'disconnected': return 'Disconnected';
      default: return 'Unknown';
    }
  }
</script>

<div class="status-indicator">
  <div class="status-item">
    <div class="status-dot" style="background-color: {getStatusColor(status.webrtc)}"></div>
    <span class="status-label">WebRTC</span>
    <span class="status-text">{getStatusText(status.webrtc)}</span>
    {#if status.webrtc === 'connected' && status.connectedPeers > 0}
      <span class="peer-count">({status.connectedPeers} peers)</span>
    {/if}
  </div>

  <div class="status-divider"></div>

  <div class="status-item">
    <div class="status-dot" style="background-color: {getStatusColor(status.websocket)}"></div>
    <span class="status-label">WebSocket</span>
    <span class="status-text">{getStatusText(status.websocket)}</span>
  </div>
</div>

<style>
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-label {
    font-weight: 500;
    color: #374151;
  }

  .status-text {
    color: #6b7280;
  }

  .peer-count {
    color: #10b981;
    font-weight: 500;
  }

  .status-divider {
    width: 1px;
    height: 20px;
    background: #e5e7eb;
  }
</style>
