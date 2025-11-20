'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';

interface UserProfile {
  username: string;
  avatarUrl: string;
  serverName: string;
  serverIcon?: string;
}

export function UserNav() {
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const loadUserProfile = async () => {
      const userId = localStorage.getItem('discordUserId');
      
      if (!userId) {
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/user-profile?userId=${userId}`);
        if (response.ok) {
          const data = await response.json();
          setUserProfile(data);
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

  if (!userProfile) {
    return (
      <div className="flex items-center gap-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback>?</AvatarFallback>
        </Avatar>
        <div className="grid gap-0.5 text-sm">
          <div className="font-medium">Not logged in</div>
          <div className="text-muted-foreground text-xs">No server selected</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-9 w-9">
        <AvatarImage src={userProfile.avatarUrl} alt={userProfile.username} />
        <AvatarFallback>{userProfile.username.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="grid gap-0.5 text-sm">
        <div className="font-medium">{userProfile.username}</div>
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          {userProfile.serverIcon && (
            <Image src={userProfile.serverIcon} alt="" width={12} height={12} className="w-3 h-3 rounded-sm" />
          )}
          <span className="truncate max-w-[160px]" title={userProfile.serverName}>
            {userProfile.serverName}
          </span>
        </div>
      </div>
    </div>
  );
}
