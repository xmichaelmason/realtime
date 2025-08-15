<script>
  import { createEventDispatcher } from 'svelte';

  export let user;

  const dispatch = createEventDispatcher();

  let roomId = '';
  let isJoining = false;
  let error = '';

  // Predefined demo rooms
  const demoRooms = [
    { id: 'general', name: 'General Discussion', description: 'Main collaboration room' },
    { id: 'project-alpha', name: 'Project Alpha', description: 'Alpha project documents' },
    { id: 'brainstorm', name: 'Brainstorming', description: 'Ideas and concepts' },
    { id: 'meeting-notes', name: 'Meeting Notes', description: 'Meeting documentation' }
  ];

  function generateRoomId() {
    const adjectives = ['swift', 'bright', 'clever', 'dynamic', 'elegant', 'focused'];
    const nouns = ['falcon', 'river', 'mountain', 'forest', 'ocean', 'star'];
    
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    const num = Math.floor(Math.random() * 1000);
    
    return `${adj}-${noun}-${num}`;
  }

  async function joinRoom(room) {
    if (!room) {
      error = 'Please enter a room ID';
      return;
    }

    // Validate room ID
    if (!/^[a-zA-Z0-9_-]+$/.test(room)) {
      error = 'Room ID can only contain letters, numbers, underscores, and hyphens';
      return;
    }

    isJoining = true;
    error = '';

    try {
      // Simulate validation delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      dispatch('join', { room });
    } catch (err) {
      error = err.message || 'Failed to join room';
    } finally {
      isJoining = false;
    }
  }

  function handleCustomRoomJoin(event) {
    event.preventDefault();
    joinRoom(roomId);
  }

  function handleDemoRoomJoin(demoRoom) {
    joinRoom(demoRoom.id);
  }

  function createNewRoom() {
    roomId = generateRoomId();
  }
</script>

<div class="room-selector">
  <div class="room-card">
    <h2 class="room-title">Join a Room</h2>
    <p class="room-subtitle">
      Welcome, <strong>{user.name}</strong>! Choose a room to start collaborating.
    </p>

    <!-- Custom Room Input -->
    <div class="custom-room-section">
      <h3>Enter Room ID</h3>
      <form onsubmit={handleCustomRoomJoin}>
        <div class="room-input-group">
          <input
            type="text"
            bind:value={roomId}
            placeholder="Enter room ID (e.g., my-project-room)"
            disabled={isJoining}
            pattern="[a-zA-Z0-9_-]+"
            title="Room ID can only contain letters, numbers, underscores, and hyphens"
          />
          <button
            type="button"
            class="generate-btn"
            onclick={createNewRoom}
            disabled={isJoining}
            title="Generate random room ID"
          >
            🎲
          </button>
        </div>

        {#if error}
          <div class="error-message">
            ⚠️ {error}
          </div>
        {/if}

        <button 
          type="submit" 
          class="join-btn"
          disabled={isJoining || !roomId.trim()}
        >
          {isJoining ? 'Joining...' : 'Join Room'}
        </button>
      </form>
    </div>

    <!-- Demo Rooms -->
    <div class="demo-rooms-section">
      <h3>Demo Rooms</h3>
      <p>Quick access to pre-configured collaboration rooms:</p>
      
      <div class="demo-rooms-grid">
        {#each demoRooms as room}
          <div class="demo-room-card">
            <div class="demo-room-header">
              <h4 class="demo-room-name">{room.name}</h4>
              <span class="demo-room-id">#{room.id}</span>
            </div>
            <p class="demo-room-description">{room.description}</p>
            <button
              class="demo-room-btn"
              onclick={() => handleDemoRoomJoin(room)}
              disabled={isJoining}
            >
              Join Room
            </button>
          </div>
        {/each}
      </div>
    </div>

    <!-- Room Info -->
    <div class="room-info">
      <h3>How it works</h3>
      <ul>
        <li><strong>Real-time collaboration:</strong> See changes from other users instantly</li>
        <li><strong>WebRTC:</strong> Direct peer-to-peer connection for low latency</li>
        <li><strong>WebSocket fallback:</strong> Reliable server-based synchronization</li>
        <li><strong>Persistent storage:</strong> Documents are automatically saved</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .room-selector {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100%;
    padding: 2rem;
  }

  .room-card {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    padding: 2.5rem;
    width: 100%;
    max-width: 700px;
  }

  .room-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: #1e293b;
    text-align: center;
  }

  .room-subtitle {
    margin: 0 0 2rem 0;
    color: #64748b;
    text-align: center;
  }

  .custom-room-section {
    margin-bottom: 2.5rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #e5e7eb;
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .room-input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  input:disabled {
    background: #f9fafb;
    cursor: not-allowed;
  }

  .generate-btn {
    padding: 0.75rem;
    background: #f8fafc;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
    min-width: 48px;
  }

  .generate-btn:hover:not(:disabled) {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    margin-bottom: 1rem;
    padding: 0.75rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #dc2626;
    font-size: 0.875rem;
  }

  .join-btn {
    width: 100%;
    padding: 0.875rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 1rem;
  }

  .join-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .join-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .demo-rooms-section {
    margin-bottom: 2rem;
  }

  .demo-rooms-section p {
    margin: 0 0 1.5rem 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  .demo-rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
  }

  .demo-room-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1.25rem;
    transition: all 0.2s;
  }

  .demo-room-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .demo-room-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .demo-room-name {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
  }

  .demo-room-id {
    font-size: 0.75rem;
    color: #6b7280;
    background: #e5e7eb;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    font-family: monospace;
  }

  .demo-room-description {
    margin: 0 0 1rem 0;
    color: #64748b;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .demo-room-btn {
    width: 100%;
    padding: 0.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    font-size: 0.875rem;
  }

  .demo-room-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .demo-room-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .room-info {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }

  .room-info h3 {
    color: #0c4a6e;
    margin-bottom: 1rem;
  }

  .room-info ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #0369a1;
  }

  .room-info li {
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .room-info li:last-child {
    margin-bottom: 0;
  }

  .room-info strong {
    color: #0c4a6e;
  }
</style>
