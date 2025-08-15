<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let token = '';
  let isLoading = false;
  let error = '';

  // Sample tokens for demo - these are generated with future expiration dates
  const currentTime = Math.floor(Date.now() / 1000);
  const oneDay = 24 * 60 * 60;
  
  function createDemoToken(id, name, email) {
    const header = { alg: "HS256", typ: "JWT" };
    const payload = {
      id: id,
      name: name,
      email: email,
      iat: currentTime,
      exp: currentTime + oneDay // expires in 24 hours
    };
    
    // Create base64 encoded parts (note: this is for demo only, not cryptographically signed)
    const encodedHeader = btoa(JSON.stringify(header)).replace(/[+\/=]/g, c => ({'+': '-', '/': '_', '=': ''}[c] || c));
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/[+\/=]/g, c => ({'+': '-', '/': '_', '=': ''}[c] || c));
    
    return `${encodedHeader}.${encodedPayload}.demo-signature`;
  }

  const sampleTokens = [
    {
      name: 'Alice',
      token: createDemoToken('user1', 'Alice', 'alice@example.com')
    },
    {
      name: 'Bob', 
      token: createDemoToken('user2', 'Bob', 'bob@example.com')
    }
  ];

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
      return null;
    }
  }

  async function handleLogin(event) {
    if (event) {
      event.preventDefault();
    }
    if (!token.trim()) {
      error = 'Please enter a JWT token';
      return;
    }

    isLoading = true;
    error = '';

    try {
      const decoded = decodeJWT(token);
      
      if (!decoded) {
        throw new Error('Invalid JWT token format');
      }

      // Check if token is expired
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Token has expired');
      }

      const user = {
        id: decoded.id,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role
      };

      dispatch('login', { token, user });
    } catch (err) {
      error = err.message || 'Invalid token';
    } finally {
      isLoading = false;
    }
  }

  function useSampleToken(sampleToken) {
    token = sampleToken;
    handleLogin();
  }

  function generateDemoToken() {
    // Generate a demo token with current timestamp
    const payload = {
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@example.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24) // 24 hours
    };

    // Simple demo token (not cryptographically secure)
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payloadEncoded = btoa(JSON.stringify(payload));
    token = `${header}.${payloadEncoded}.demo-signature`;
  }
</script>

<div class="login-form">
  <div class="login-card">
    <h2 class="login-title">Welcome to Collaborative Editor</h2>
    <p class="login-subtitle">Enter your JWT token to start collaborating</p>

    <form onsubmit={handleLogin}>
      <div class="form-group">
        <label for="token">JWT Token:</label>
        <textarea
          id="token"
          bind:value={token}
          placeholder="Paste your JWT token here..."
          rows="4"
          disabled={isLoading}
        ></textarea>
      </div>

      {#if error}
        <div class="error-message">
          ⚠️ {error}
        </div>
      {/if}

      <button 
        type="submit" 
        class="login-btn"
        disabled={isLoading || !token.trim()}
      >
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>

    <div class="demo-section">
      <h3>Quick Start</h3>
      <p>For testing, you can use these demo tokens:</p>
      
      <div class="demo-tokens">
        {#each sampleTokens as sample}
          <button 
            class="demo-token-btn"
            onclick={() => useSampleToken(sample.token)}
            disabled={isLoading}
          >
            Login as {sample.name}
          </button>
        {/each}
      </div>

      <button 
        class="generate-demo-btn"
        onclick={generateDemoToken}
        disabled={isLoading}
      >
        Generate Demo Token
      </button>

      <div class="help-text">
        <p><strong>Need a token?</strong></p>
        <p>Run the token generator: <code>node scripts/generate-jwt.js</code></p>
      </div>
    </div>
  </div>
</div>

<style>
  .login-form {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100%;
    padding: 2rem;
  }

  .login-card {
    background: white;
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    padding: 2.5rem;
    width: 100%;
    max-width: 500px;
  }

  .login-title {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: #1e293b;
    text-align: center;
  }

  .login-subtitle {
    margin: 0 0 2rem 0;
    color: #64748b;
    text-align: center;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #374151;
  }

  textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 0.875rem;
    resize: vertical;
    min-height: 100px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  textarea:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  textarea:disabled {
    background: #f9fafb;
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

  .login-btn {
    width: 100%;
    padding: 0.875rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-bottom: 2rem;
  }

  .login-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .login-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .demo-section {
    border-top: 1px solid #e5e7eb;
    padding-top: 2rem;
  }

  .demo-section h3 {
    margin: 0 0 1rem 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .demo-section p {
    margin: 0 0 1rem 0;
    color: #64748b;
    font-size: 0.875rem;
  }

  .demo-tokens {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .demo-token-btn {
    flex: 1;
    padding: 0.5rem 0.75rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.375rem;
    color: #475569;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .demo-token-btn:hover:not(:disabled) {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  .demo-token-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .generate-demo-btn {
    width: 100%;
    padding: 0.5rem;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    transition: background-color 0.2s;
  }

  .generate-demo-btn:hover:not(:disabled) {
    background: #059669;
  }

  .generate-demo-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .help-text {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
  }

  .help-text p {
    margin: 0 0 0.5rem 0;
  }

  .help-text p:last-child {
    margin-bottom: 0;
  }

  code {
    background: #e2e8f0;
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-family: 'Monaco', 'Consolas', monospace;
    font-size: 0.8rem;
  }
</style>
