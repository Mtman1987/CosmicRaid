'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Hardcoded for testing - change these to secure the app later
// Multi-tenant app - no hardcoded values

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    discordServerId: HARDCODED_SERVER_ID,
    discordUserId: HARDCODED_USER_ID,
    twitchUsername: 'unknown'
  });

  // Load saved values on mount (for display purposes)
  useEffect(() => {
    const saved = {
      discordServerId: localStorage.getItem('discordServerId') || HARDCODED_SERVER_ID,
      discordUserId: localStorage.getItem('discordUserId') || HARDCODED_USER_ID,
      twitchUsername: localStorage.getItem('twitchUsername') || 'unknown'
    };
    setFormData(saved);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate unique session ID for this user
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save to localStorage for client-side
    localStorage.setItem('discordServerId', formData.discordServerId);
    localStorage.setItem('discordUserId', formData.discordUserId);
    localStorage.setItem('twitchUsername', formData.twitchUsername);
    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('isLoggedIn', 'true');
    
    // Save to Firestore for server-side functions with session ID
    const serverFormData = new FormData();
    serverFormData.append('serverId', formData.discordServerId);
    serverFormData.append('userId', formData.discordUserId);
    serverFormData.append('twitchUsername', formData.twitchUsername);
    serverFormData.append('sessionId', sessionId);
    
    try {
      const { saveLoginCredentials } = await import('@/lib/actions');
      await saveLoginCredentials(null, serverFormData);
    } catch (error) {
      console.error('Failed to save credentials to server:', error);
    }
    
    router.push('/dashboard');
  };

  const handleReset = () => {
    localStorage.clear();
    setFormData({ discordServerId: '', discordUserId: '', twitchUsername: '' });
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0f0f23',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1a1a2e',
        border: '1px solid #333',
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            fontSize: '12px',
            fontStyle: 'italic',
            color: '#888',
            marginBottom: '16px'
          }}>
            "Ad astra per aspera"
          </div>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>🚀</div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Cosmic Raid
          </h1>
          <p style={{
            color: '#888',
            margin: 0,
            fontSize: '14px'
          }}>
            Enter your details to access the dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Discord Server ID
            </label>
            <input
              type="text"
              value={formData.discordServerId}
              onChange={(e) => setFormData(prev => ({ ...prev, discordServerId: e.target.value }))}
              placeholder="Your server's unique ID"
              required
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#16213e',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Discord User ID
            </label>
            <input
              type="text"
              value={formData.discordUserId}
              onChange={(e) => setFormData(prev => ({ ...prev, discordUserId: e.target.value }))}
              placeholder="Your personal Discord ID"
              required
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#16213e',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Twitch Username
            </label>
            <input
              type="text"
              value={formData.twitchUsername}
              onChange={(e) => setFormData(prev => ({ ...prev, twitchUsername: e.target.value }))}
              placeholder="Your Twitch channel name"
              required
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: '#16213e',
                border: '1px solid #333',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#667eea',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '10px'
            }}
          >
            Continue
          </button>

          <div style={{
            textAlign: 'center',
            margin: '20px 0 10px 0',
            color: '#666',
            fontSize: '12px'
          }}>
            or
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: 'transparent',
              color: '#888',
              border: '1px solid #333',
              borderRadius: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            Clear Session & Reload
          </button>
        </form>
      </div>
    </div>
  );
}