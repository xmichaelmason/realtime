import { writable } from 'svelte/store';

function createAuthStore() {
  const { subscribe, set, update } = writable({
    token: null,
    user: null,
    isAuthenticated: false
  });

  // Simple JWT decode (without verification - for display only)
  function decodeJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      return null;
    }
  }

  return {
    subscribe,
    
    setToken: (token) => {
      const decoded = decodeJWT(token);
      if (decoded) {
        const user = {
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role
        };
        
        localStorage.setItem('authToken', token);
        set({
          token,
          user,
          isAuthenticated: true
        });
      } else {
        console.error('Invalid token');
      }
    },

    getToken: () => {
      return localStorage.getItem('authToken');
    },

    getCurrentUser: () => {
      const token = localStorage.getItem('authToken');
      if (token) {
        const decoded = decodeJWT(token);
        return decoded ? {
          id: decoded.id,
          name: decoded.name,
          email: decoded.email,
          role: decoded.role
        } : null;
      }
      return null;
    },

    logout: () => {
      localStorage.removeItem('authToken');
      set({
        token: null,
        user: null,
        isAuthenticated: false
      });
    }
  };
}

export const authStore = createAuthStore();
