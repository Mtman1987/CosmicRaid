'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const HARDCODED_SERVER_ID = '';
const HARDCODED_USER_ID = '';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    discordServerId: HARDCODED_SERVER_ID,
    discordUserId: HARDCODED_USER_ID,
    twitchUsername: 'unknown'
  });

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

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    localStorage.setItem('discordServerId', formData.discordServerId);
    localStorage.setItem('discordUserId', formData.discordUserId);
    localStorage.setItem('twitchUsername', formData.twitchUsername);
    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('isLoggedIn', 'true');

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
    <div className="min-h-screen bg-[#0f0f23] text-white flex items-center justify-center p-5 font-sans">
      <div className="w-full max-w-md rounded-xl border border-[#333] bg-[#1a1a2e] p-10 shadow-2xl shadow-black/40">
        <div className="text-center mb-8 space-y-2">
          <div className="text-xs italic text-gray-400">"Ad astra per aspera"</div>
          <div className="text-5xl mb-2">🚀</div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
            Cosmic Raid
          </h1>
          <p className="text-sm text-gray-400 m-0">Enter your details to access the dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Discord Server ID</label>
            <input
              className="w-full rounded-md border border-[#333] bg-[#16213e] px-3 py-3 text-sm text-white outline-none"
              type="text"
              value={formData.discordServerId}
              onChange={(e) => setFormData(prev => ({ ...prev, discordServerId: e.target.value }))}
              placeholder="Your server's unique ID"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Discord User ID</label>
            <input
              className="w-full rounded-md border border-[#333] bg-[#16213e] px-3 py-3 text-sm text-white outline-none"
              type="text"
              value={formData.discordUserId}
              onChange={(e) => setFormData(prev => ({ ...prev, discordUserId: e.target.value }))}
              placeholder="Your personal Discord ID"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Twitch Username</label>
            <input
              className="w-full rounded-md border border-[#333] bg-[#16213e] px-3 py-3 text-sm text-white outline-none"
              type="text"
              value={formData.twitchUsername}
              onChange={(e) => setFormData(prev => ({ ...prev, twitchUsername: e.target.value }))}
              placeholder="Your Twitch channel name"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-gradient-to-r from-indigo-400 to-purple-500 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-indigo-500/40"
          >
            Launch
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full rounded-md border border-[#333] px-3 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors"
          >
            Reset
          </button>
        </form>
      </div>
    </div>
  );
}
