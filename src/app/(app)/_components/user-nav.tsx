'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { testDatabaseConnection } from '@/lib/actions';

interface UserProfile {
  username: string;
  avatarUrl: string;
}

export function UserNav() {
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [serverId, setServerId] = React.useState('');
  const [userId, setUserId] = React.useState('');

  React.useEffect(() => {
    const loadUserProfile = async () => {
      const sessionId = localStorage.getItem('sessionId');
      const storedServerId = localStorage.getItem('discordServerId') || '';
      const storedUserId = localStorage.getItem('discordUserId') || '';
      
      setServerId(storedServerId);
      setUserId(storedUserId);
      
      if (!sessionId) {
        setIsLoading(false);
        return;
      }
      
      try {
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        
        const result = await testDatabaseConnection(null, formData);
        if (result.status === 'success' && result.data) {
          setUserProfile({
            username: result.data.username || 'Unknown',
            avatarUrl: result.data.avatarUrl || ''
          });
        }
      } catch (error) {
        console.error('[UserNav] Failed to load user profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadUserProfile();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="grid gap-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  const displayName = userProfile?.username || userId || 'Not logged in';
  const avatarUrl = userProfile?.avatarUrl || '';
  const displayServer = serverId ? `Server: ${serverId}` : 'No server selected';

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        {avatarUrl && (
          <AvatarImage src={avatarUrl} alt={displayName} />
        )}
        <AvatarFallback>{displayName.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="grid gap-0.5 text-sm">
        <div className="font-medium">{displayName}</div>
        <div className="text-muted-foreground text-xs truncate max-w-[180px]" title={displayServer}>
          {displayServer}
        </div>
      </div>
    </div>
  );
}
