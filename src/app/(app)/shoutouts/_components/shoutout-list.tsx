'use client';

import * as React from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserProfile } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Rocket, Users, Clock, Trophy, Send } from 'lucide-react';

function OnlineStreamerCard({ streamer }: { streamer: UserProfile }) {
  const handlePostShoutout = () => {
    if (streamer.dailyShoutout) {
      console.log('--- Posting Shoutout for', streamer.username, '---');
      console.log(JSON.stringify(streamer.dailyShoutout, null, 2));
      alert(`Shoutout for ${streamer.username} logged to console!`);
    } else {
      alert(`No AI-generated shoutout available for ${streamer.username}.`);
    }
  };

  // Placeholder data
  const viewerCount = Math.floor(Math.random() * 500) + 50;
  const uptime = `${Math.floor(Math.random() * 4) + 1}h ${Math.floor(Math.random() * 60)}m`;
  const points = Math.floor(Math.random() * 1500) + 200;

  return (
    <Card className="flex flex-col">
      <CardHeader className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border-2 border-green-500">
            <AvatarImage src={streamer.avatarUrl} alt={streamer.username} />
            <AvatarFallback>{streamer.username.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle>
              <Link
                href={`https://twitch.tv/${streamer.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {streamer.username}
              </Link>
            </CardTitle>
            <CardDescription className="truncate">
              {streamer.topic || 'Streaming now!'}
            </CardDescription>
          </div>
          <Rocket className="h-6 w-6 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-4 flex-1">
        <div className="aspect-video w-full overflow-hidden rounded-md">
            <Image
                src={`https://picsum.photos/seed/stream-${streamer.discordUserId}/400/225`}
                alt={`Stream preview for ${streamer.username}`}
                width={400}
                height={225}
                className="object-cover w-full h-full"
            />
        </div>
        <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground h-full">
          <p className="line-clamp-3">
            {streamer.dailyShoutout?.description || 'No AI shoutout generated yet.'}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-4 p-4 pt-0">
         <div className="grid grid-cols-3 gap-2 w-full text-xs text-center">
            <div className="flex flex-col items-center gap-1 bg-secondary p-2 rounded-md">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{viewerCount}</span>
                <span className="text-muted-foreground">Viewers</span>
            </div>
             <div className="flex flex-col items-center gap-1 bg-secondary p-2 rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{uptime}</span>
                <span className="text-muted-foreground">Uptime</span>
            </div>
             <div className="flex flex-col items-center gap-1 bg-secondary p-2 rounded-md">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{points.toLocaleString()}</span>
                <span className="text-muted-foreground">Points</span>
            </div>
        </div>
        <Button onClick={handlePostShoutout} className="w-full">
            <Send className="mr-2 h-4 w-4" />
            Post Shoutout
        </Button>
      </CardFooter>
    </Card>
  );
}

function OfflineStreamerTile({ streamer }: { streamer: UserProfile }) {
    return (
        <div className="flex flex-col items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors">
            <Avatar className="h-12 w-12">
                <AvatarImage src={streamer.avatarUrl} alt={streamer.username} />
                <AvatarFallback>{streamer.username.charAt(0)}</AvatarFallback>
            </Avatar>
            <p className="text-xs text-center font-medium truncate w-full">{streamer.username}</p>
        </div>
    )
}

export function ShoutoutList() {
  const firestore = useFirestore();
  const [serverId, setServerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setServerId(localStorage.getItem('discordServerId'));
  }, []);

  const usersCollectionRef = useMemoFirebase(() => {
    if (!firestore || !serverId) return null;
    return collection(firestore, 'servers', serverId, 'users');
  }, [firestore, serverId]);

  const { data: allUsers, isLoading: isLoadingUsers } =
    useCollection<UserProfile>(usersCollectionRef);

  const { onlineUsers, offlineUsers } = React.useMemo(() => {
    return {
      onlineUsers: allUsers?.filter((u) => u.isOnline) || [],
      offlineUsers: allUsers?.filter((u) => !u.isOnline) || [],
    };
  }, [allUsers]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-headline text-primary mb-2">
          Online Streamers
        </h2>
        <p className="text-muted-foreground">
          Generate and post shoutouts for all currently online members. These cards contain their latest AI-generated message.
        </p>
      </div>

      {isLoadingUsers && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
             {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[450px] w-full rounded-lg" />)}
        </div>
      )}
      {!isLoadingUsers && onlineUsers.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {onlineUsers.map((streamer) => (
            <OnlineStreamerCard key={streamer.discordUserId} streamer={streamer} />
          ))}
        </div>
      )}
      {!isLoadingUsers && onlineUsers.length === 0 && (
         <Card className="flex flex-col items-center justify-center py-20 text-center">
            <CardHeader>
                <Rocket className="mx-auto h-12 w-12 text-muted-foreground" />
                <CardTitle className="mt-4">All Quiet on the Frontier</CardTitle>
                <CardDescription>No streamers are currently online.</CardDescription>
            </CardHeader>
         </Card>
      )}

      <Separator />

       <div>
        <h2 className="text-2xl font-headline text-primary mb-2">
          Offline Community Members ({offlineUsers.length})
        </h2>
        <p className="text-muted-foreground">
          A list of all community members who are currently offline.
        </p>
      </div>

       <Card>
        <CardContent className="p-4">
        {isLoadingUsers && (
             <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-4">
                 {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-2">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <Skeleton className="h-3 w-10" />
                    </div>
                 ))}
            </div>
        )}
        {!isLoadingUsers && offlineUsers.length > 0 && (
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-x-4 gap-y-6">
                {offlineUsers.map((streamer) => (
                    <OfflineStreamerTile key={streamer.discordUserId} streamer={streamer} />
                ))}
            </div>
        )}
        {!isLoadingUsers && offlineUsers.length === 0 && (
            <p className="py-10 text-center text-muted-foreground">
                No offline users found.
            </p>
        )}
        </CardContent>
       </Card>

    </div>
  );
}
