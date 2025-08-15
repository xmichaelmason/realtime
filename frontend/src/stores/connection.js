import { writable } from 'svelte/store';

function createConnectionStore() {
  const { subscribe, set, update } = writable({
    webrtc: 'disconnected',
    websocket: 'disconnected',
    connectedPeers: 0,
    lastSync: null
  });

  return {
    subscribe,
    
    updateWebRTC: (status, peerCount = 0) => {
      update(state => ({
        ...state,
        webrtc: status,
        connectedPeers: peerCount,
        lastSync: status === 'connected' ? new Date() : state.lastSync
      }));
    },

    updateWebSocket: (status) => {
      update(state => ({
        ...state,
        websocket: status,
        lastSync: status === 'connected' ? new Date() : state.lastSync
      }));
    },

    reset: () => {
      set({
        webrtc: 'disconnected',
        websocket: 'disconnected',
        connectedPeers: 0,
        lastSync: null
      });
    }
  };
}

export const connectionStore = createConnectionStore();
