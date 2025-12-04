'use client';

import { useEffect, useState } from 'react';

interface ActiveUser {
  userId: string;
  username: string;
  avatarUrl?: string;
  isOnline: boolean;
  lastSeen: Date;
}

export function ActiveUsersHeader({ serverId }: { serverId: string }) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);

  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const response = await fetch(`/api/active-users?serverId=${serverId}`);
        if (response.ok) {
          const users = await response.json();
          setActiveUsers(users);
        }
      } catch (error) {
        console.error('Failed to fetch active users:', error);
      }
    };

    fetchActiveUsers();
    const interval = setInterval(fetchActiveUsers, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [serverId]);

  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-4">
      <span className="text-sm text-gray-600">Online:</span>
      {activeUsers.map(user => (
        <div 
          key={user.userId} 
          className="relative"
          title={`${user.username} - ${user.isOnline ? 'Online' : 'Offline'}`}
        >
          <img 
            src={user.avatarUrl || '/default-avatar.png'} 
            alt={user.username}
            className="w-8 h-8 rounded-full border-2 border-gray-300"
          />
          <div 
            className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
              user.isOnline ? 'bg-green-500' : 'bg-gray-400'
            }`} 
          />
        </div>
      ))}
    </div>
  );
}