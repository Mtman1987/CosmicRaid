'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Auto-login with hardcoded credentials
    localStorage.setItem('isLoggedIn', 'true');
    // Multi-tenant app - users must login with their own credentials
    
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

    
