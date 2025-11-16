'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Auto-login with hardcoded credentials
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('discordServerId', '1240832965865635881');
    localStorage.setItem('discordUserId', '767875979561009173');
    localStorage.setItem('twitchUsername', 'mtman1987');
    
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p>Auto-logging in...</p>
      </div>
    </div>
  );
}

    
