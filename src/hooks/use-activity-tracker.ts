'use client';

import { useEffect } from 'react';

export function useActivityTracker(userId: string) {
  useEffect(() => {
    if (!userId) return;

    const updateActivity = async () => {
      try {
        await fetch('/api/user-activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        });
      } catch (error) {
        console.error('Failed to update user activity:', error);
      }
    };

    // Update activity on page load
    updateActivity();

    // Update on visibility change
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity();
      }
    };

    // Update on focus
    const handleFocus = () => {
      updateActivity();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Update every 2 minutes while active
    const interval = setInterval(updateActivity, 120000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [userId]);
}