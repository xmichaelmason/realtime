<script>
  import { onMount, onDestroy } from 'svelte';
  import * as Y from 'yjs';
  import { WebsocketProvider } from 'y-websocket';
  import { WebrtcProvider } from 'y-webrtc';
  import { connectionStore } from '../stores/connection.js';

  export let room;
  export let user;
  export let token;

  let editorElement;
  let titleElement;
  let ydoc;
  let wsProvider;
  let webrtcProvider;
  let ytext;
  let ytitle;
  let content = '';
  let title = '';
  let isConnecting = true;
  let error = '';

  // Configuration from environment or defaults
  const WS_SERVER_URL = import.meta.env.VITE_WS_SERVER_URL || 'ws://localhost:1234';
  const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL || 'ws://localhost:3001';

  onMount(async () => {
    try {
      await initializeCollaboration();
    } catch (err) {
      console.error('Failed to initialize collaboration:', err);
      error = err.message || 'Failed to connect to collaboration servers';
      isConnecting = false;
    }
  });

  onDestroy(() => {
    cleanup();
  });

  async function initializeCollaboration() {
    // Create Yjs document
    ydoc = new Y.Doc();
    
    // Get shared types
    ytext = ydoc.getText('content');
    ytitle = ydoc.getText('title');

    // Create user awareness info
    const awarenessInfo = {
      name: user.name,
      color: generateUserColor(user.id),
      colorLight: generateUserColor(user.id, true),
      user: user
    };

    // Set up WebSocket provider with authentication
    // y-websocket expects: new WebsocketProvider(serverUrl, roomName, doc, options)
    // It will create: ws://serverUrl/roomName?params
    const wsServerUrl = `${WS_SERVER_URL.replace('ws://', 'ws://').replace('wss://', 'wss://')}`;
    wsProvider = new WebsocketProvider(wsServerUrl, room, ydoc, {
      connect: true,
      params: { token: token }
    });

    // Set awareness info for WebSocket
    wsProvider.awareness.setLocalStateField('user', awarenessInfo);

    // Set up WebRTC provider with authentication  
    const signalingUrls = [`${SIGNALING_SERVER_URL}?token=${encodeURIComponent(token)}`];
    webrtcProvider = new WebrtcProvider(room, ydoc, {
      signaling: signalingUrls,
      password: null,
      awareness: wsProvider.awareness, // Share the same awareness
      maxConns: 20 + Math.floor(Math.random() * 15),
      filterBcConns: true,
      peerOpts: {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      }
    });

    // Set initial WebRTC status
    connectionStore.updateWebRTC('connecting', 0);

    // Set up connection status tracking
    setupConnectionTracking();

    // Bind Yjs to DOM elements
    setupTextBinding();

    // Set initial focus
    if (editorElement) {
      editorElement.focus();
    }

    isConnecting = false;
  }

  function setupConnectionTracking() {
    // WebSocket status
    wsProvider.on('status', (event) => {
      console.log('WebSocket status:', event.status);
      connectionStore.updateWebSocket(event.status);
    });

    wsProvider.on('connection-error', (error) => {
      console.error('WebSocket connection error:', error);
      connectionStore.updateWebSocket('disconnected');
    });

    // WebRTC status - y-webrtc uses different events
    // Track connection state changes
    webrtcProvider.on('synced', () => {
      console.log('WebRTC: Synced');
      connectionStore.updateWebRTC('connected', Object.keys(webrtcProvider.room?.webrtcConns || {}).length);
    });

    webrtcProvider.on('peers', (event) => {
      console.log('WebRTC peers changed:', event);
      const peerCount = Object.keys(webrtcProvider.room?.webrtcConns || {}).length;
      console.log('WebRTC peer count:', peerCount);
      connectionStore.updateWebRTC('connected', peerCount);
    });

    // Listen for WebRTC room state changes
    if (webrtcProvider.room) {
      const room = webrtcProvider.room;
      
      // Monitor connection changes
      const checkWebRTCStatus = () => {
        const peerCount = Object.keys(room.webrtcConns || {}).length;
        const bcConnected = room.bcConnected;
        const status = bcConnected || peerCount > 0 ? 'connected' : 'connecting';
        console.log('WebRTC status check:', { status, peerCount, bcConnected });
        connectionStore.updateWebRTC(status, peerCount);
      };

      // Check status periodically
      const statusInterval = setInterval(checkWebRTCStatus, 2000);
      
      // Initial status check
      setTimeout(checkWebRTCStatus, 1000);
      
      // Store interval for cleanup
      window._webrtcStatusInterval = statusInterval;
    }

    // Also listen for awareness changes as a proxy for connection state
    if (wsProvider.awareness) {
      wsProvider.awareness.on('change', () => {
        const remoteAwarenessStates = wsProvider.awareness.getStates();
        const remoteUserCount = remoteAwarenessStates.size - 1; // Exclude self
        console.log('Awareness change - remote users:', remoteUserCount);
      });
    }
  }

  function setupTextBinding() {
    // Initial content sync
    content = ytext.toString();
    title = ytitle.toString() || `Document in ${room}`;

    // Track if we're currently updating from local input to avoid loops
    let isLocalUpdate = false;

    // Listen for remote changes
    ytext.observe((event) => {
      if (!isLocalUpdate) {
        content = ytext.toString();
      }
    });

    ytitle.observe((event) => {
      if (!isLocalUpdate) {
        title = ytitle.toString() || `Document in ${room}`;
      }
    });

    // Store the update flag for use in input handlers
    window._isLocalUpdate = {
      get: () => isLocalUpdate,
      set: (value) => { isLocalUpdate = value; }
    };
  }

  function handleContentInput(event) {
    const newContent = event.target.value;
    const cursor = event.target.selectionStart;
    
    // Calculate delta
    if (newContent !== content) {
      // Set flag to prevent observer from updating during local change
      if (window._isLocalUpdate) {
        window._isLocalUpdate.set(true);
      }
      
      ydoc.transact(() => {
        ytext.delete(0, ytext.length);
        ytext.insert(0, newContent);
      });
      
      content = newContent;
      
      // Reset flag after transaction
      if (window._isLocalUpdate) {
        setTimeout(() => window._isLocalUpdate.set(false), 0);
      }
      
      // Restore cursor position
      requestAnimationFrame(() => {
        if (editorElement) {
          editorElement.selectionStart = cursor;
          editorElement.selectionEnd = cursor;
        }
      });
    }
  }

  function handleTitleInput(event) {
    const newTitle = event.target.value;
    
    if (newTitle !== title) {
      // Set flag to prevent observer from updating during local change
      if (window._isLocalUpdate) {
        window._isLocalUpdate.set(true);
      }
      
      ydoc.transact(() => {
        ytitle.delete(0, ytitle.length);
        ytitle.insert(0, newTitle);
      });
      
      title = newTitle;
      
      // Reset flag after transaction
      if (window._isLocalUpdate) {
        setTimeout(() => window._isLocalUpdate.set(false), 0);
      }
    }
  }

  function generateUserColor(userId, light = false) {
    // Generate consistent color based on user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const hue = Math.abs(hash) % 360;
    const saturation = light ? 30 : 70;
    const lightness = light ? 90 : 50;
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  function cleanup() {
    // Clear WebRTC status interval
    if (window._webrtcStatusInterval) {
      clearInterval(window._webrtcStatusInterval);
      window._webrtcStatusInterval = null;
    }
    
    if (wsProvider) {
      wsProvider.destroy();
    }
    if (webrtcProvider) {
      webrtcProvider.destroy();
    }
    if (ydoc) {
      ydoc.destroy();
    }
    connectionStore.reset();
  }

  // Reactive statements to sync with Yjs when content changes externally
  $: if (ydoc && content !== ytext?.toString()) {
    content = ytext?.toString() || '';
  }

  $: if (ydoc && title !== ytitle?.toString()) {
    title = ytitle?.toString() || `Document in ${room}`;
  }
</script>

<div class="collaborative-editor">
  {#if isConnecting}
    <div class="loading-container">
      <div class="loading-spinner"></div>
      <h3>Connecting to collaboration servers...</h3>
      <p>Setting up WebSocket and WebRTC connections</p>
    </div>
  {:else if error}
    <div class="error-container">
      <div class="error-icon">⚠️</div>
      <h3>Connection Error</h3>
      <p>{error}</p>
      <button class="retry-btn" onclick={() => window.location.reload()}>
        Retry Connection
      </button>
    </div>
  {:else}
    <div class="editor-container">
      <!-- Document Title -->
      <div class="title-section">
        <input
          bind:this={titleElement}
          class="title-input"
          type="text"
          value={title}
          oninput={handleTitleInput}
          placeholder="Document title..."
        />
      </div>

      <!-- Collaborative Text Editor -->
      <div class="content-section">
        <textarea
          bind:this={editorElement}
          class="content-editor"
          value={content}
          oninput={handleContentInput}
          placeholder="Start typing to collaborate with others in real-time..."
          spellcheck="false"
        ></textarea>
      </div>

      <!-- Editor Info -->
      <div class="editor-info">
        <div class="info-item">
          <span class="info-label">Room:</span>
          <span class="info-value">{room}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Characters:</span>
          <span class="info-value">{content.length}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Lines:</span>
          <span class="info-value">{content.split('\n').length}</span>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .collaborative-editor {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .loading-container,
  .error-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 3rem;
    text-align: center;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #e5e7eb;
    border-top: 4px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1.5rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-container h3,
  .error-container h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .loading-container p,
  .error-container p {
    margin: 0;
    color: #64748b;
  }

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .retry-btn {
    margin-top: 1.5rem;
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .retry-btn:hover {
    background: #2563eb;
  }

  .editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }

  .title-section {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 1.5rem;
  }

  .title-input {
    width: 100%;
    border: none;
    background: transparent;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    outline: none;
    padding: 0.5rem 0;
    border-bottom: 2px solid transparent;
    transition: border-color 0.2s;
  }

  .title-input:focus {
    border-bottom-color: #3b82f6;
  }

  .title-input::placeholder {
    color: #9ca3af;
  }

  .content-section {
    flex: 1;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
  }

  .content-editor {
    flex: 1;
    border: none;
    outline: none;
    resize: none;
    font-family: 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #1e293b;
    background: transparent;
    padding: 0;
    min-height: 400px;
  }

  .content-editor::placeholder {
    color: #9ca3af;
    font-style: italic;
  }

  .editor-info {
    display: flex;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    font-size: 0.875rem;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .info-label {
    color: #6b7280;
    font-weight: 500;
  }

  .info-value {
    color: #1e293b;
    font-weight: 600;
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .editor-info {
      flex-direction: column;
      gap: 0.5rem;
    }

    .title-input {
      font-size: 1.25rem;
    }

    .content-editor {
      font-size: 16px; /* Prevents zoom on iOS */
    }
  }
</style>
