<script>
  import { onMount } from 'svelte';
  import CollaborativeEditor from './components/CollaborativeEditor.svelte';
  import LoginForm from './components/LoginForm.svelte';
  import RoomSelector from './components/RoomSelector.svelte';
  import StatusIndicator from './components/StatusIndicator.svelte';
  import { authStore } from './stores/auth.js';
  import { connectionStore } from './stores/connection.js';

  let currentUser = null;
  let currentRoom = null;
  let connectionStatus = { webrtc: 'disconnected', websocket: 'disconnected' };

  onMount(() => {
    // Check for existing auth token
    const token = localStorage.getItem('authToken');
    if (token) {
      authStore.setToken(token);
      currentUser = authStore.getCurrentUser();
    }

    // Subscribe to connection status
    const unsubscribe = connectionStore.subscribe((status) => {
      connectionStatus = status;
    });

    return unsubscribe;
  });

  function handleLogin(event) {
    const { token, user } = event.detail;
    authStore.setToken(token);
    currentUser = user;
  }

  function handleLogout() {
    authStore.logout();
    currentUser = null;
    currentRoom = null;
  }

  function handleRoomJoin(event) {
    currentRoom = event.detail.room;
  }

  function handleRoomLeave() {
    currentRoom = null;
  }
</script>

<main class="app">
  <header class="header">
    <div class="header-content">
      <h1 class="title">
        📝 Collaborative Editor
      </h1>
      
      <div class="header-right">
        <StatusIndicator status={connectionStatus} />
        
        {#if currentUser}
          <div class="user-info">
            <span class="username">👋 {currentUser.name}</span>
            <button class="logout-btn" onclick={handleLogout}>
              Logout
            </button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  <div class="main-content">
    {#if !currentUser}
      <div class="login-container">
        <LoginForm on:login={handleLogin} />
      </div>
    {:else if !currentRoom}
      <div class="room-container">
        <RoomSelector 
          user={currentUser} 
          on:join={handleRoomJoin} 
        />
      </div>
    {:else}
      <div class="editor-container">
        <div class="editor-header">
          <h2 class="room-title">Room: {currentRoom}</h2>
          <button class="leave-btn" onclick={handleRoomLeave}>
            ← Leave Room
          </button>
        </div>
        
        <CollaborativeEditor 
          room={currentRoom}
          user={currentUser}
          token={authStore.getToken()}
        />
      </div>
    {/if}
  </div>
</main>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
  }

  .header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }

  .header-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .username {
    font-weight: 500;
    color: #374151;
  }

  .logout-btn {
    padding: 0.5rem 1rem;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .logout-btn:hover {
    background: #dc2626;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .login-container,
  .room-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem;
  }

  .editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
    width: 100%;
  }

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .room-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .leave-btn {
    padding: 0.5rem 1rem;
    background: #6b7280;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .leave-btn:hover {
    background: #4b5563;
  }
</style>
