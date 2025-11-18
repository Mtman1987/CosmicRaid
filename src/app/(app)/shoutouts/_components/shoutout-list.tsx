'use client';

import * as React from 'react';
import { useServerId } from '@/lib/get-server-id';
import { useShoutoutChannel } from '@/lib/use-server-config';
import { useActionState } from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { Rocket, Users, Clock, Trophy, Send, Loader2, Save, Trash2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { postShoutoutAction } from '@/lib/actions';
import { deriveStreamStats, getMediaPreviewUrl } from '@/lib/shoutout-display';

function PostShoutoutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      {pending ? 'Posting…' : 'Post Shoutout'}
    </Button>
  );
}

function OnlineStreamerCard({
  streamer,
  serverId,
  channelId,
}: {
  streamer: UserProfile
  serverId: string | null
  channelId: string | null
}) {
  const { toast } = useToast();
  const [state, formAction] = useActionState(postShoutoutAction, { status: 'idle', message: '' });

  const stats = React.useMemo(() => deriveStreamStats(streamer), [streamer]);
  const previewUrl = React.useMemo(() => getMediaPreviewUrl(streamer), [streamer]);

  const payload = React.useMemo(() => {
    if (!streamer.dailyShoutout) {
      return null;
    }
    try {
      return JSON.stringify(streamer.dailyShoutout);
    } catch (error) {
      console.error('Failed to serialise shoutout payload', error);
      return null;
    }
  }, [streamer.dailyShoutout]);

  const canPost = Boolean(serverId && channelId && payload);

  React.useEffect(() => {
    if (state.status === 'success') {
      toast({
        title: 'Shoutout posted',
        description: state.message,
      });
    } else if (state.status === 'error') {
      toast({
        variant: 'destructive',
        title: 'Shoutout failed',
        description: state.message,
      });
    }
  }, [state, toast]);

  const handleDisabledPost = React.useCallback(() => {
    if (!streamer.dailyShoutout) {
      toast({
        variant: 'destructive',
        title: 'Missing shoutout content',
        description: `No AI-generated shoutout is available for ${streamer.username}.`,
      });
      return;
    }
    if (!serverId) {
      toast({
        variant: 'destructive',
        title: 'Missing server context',
        description: 'Log in with your Discord server before posting shoutouts.',
      });
      return;
    }
    if (!channelId) {
      toast({
        variant: 'destructive',
        title: 'Configure a shoutout channel',
        description: 'Set a Discord channel ID above before posting.',
      });
      return;
    }
  }, [channelId, serverId, streamer.dailyShoutout, streamer.username, toast]);

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
            src={previewUrl}
            alt={`Stream preview for ${streamer.username}`}
            width={400}
            height={225}
            className="object-cover w-full h-full"
            unoptimized
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
                <span className="font-semibold">{stats.viewerCount ?? '—'}</span>
                <span className="text-muted-foreground">Viewers</span>
            </div>
             <div className="flex flex-col items-center gap-1 bg-secondary p-2 rounded-md">
                <Trophy className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold line-clamp-1">{stats.gameTitle}</span>
                <span className="text-muted-foreground">Game</span>
            </div>
             <div className="flex flex-col items-center gap-1 bg-secondary p-2 rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{stats.updatedLabel ?? 'Not synced'}</span>
                <span className="text-muted-foreground">Updated</span>
            </div>
        </div>
        {canPost ? (
          <form action={formAction} className="w-full">
            <input type="hidden" name="serverId" value={serverId ?? ''} />
            <input type="hidden" name="channelId" value={channelId ?? ''} />
            <input type="hidden" name="streamerName" value={streamer.username} />
            <input type="hidden" name="payload" value={payload ?? ''} />
            <PostShoutoutButton />
          </form>
        ) : (
          <Button className="w-full" variant="outline" onClick={handleDisabledPost}>
            <Send className="mr-2 h-4 w-4" />
            Post Shoutout
          </Button>
        )}
        {state.status !== 'idle' && (
          <p className="text-xs text-muted-foreground text-center w-full">{state.message}</p>
        )}
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
    const serverId = useServerId();
  const { toast } = useToast();
  const { channelId: shoutoutChannelId, saveChannel } = useShoutoutChannel('default');
  const [channelInput, setChannelInput] = React.useState<string>('');

  React.useEffect(() => {
    if (shoutoutChannelId) {
      setChannelInput(shoutoutChannelId);
    }
  }, [shoutoutChannelId]);

  const handleChannelSave = React.useCallback(async () => {
    const trimmed = channelInput.trim();
    if (!trimmed) {
      toast({
        variant: 'destructive',
        title: 'Channel ID required',
        description: 'Enter a Discord channel ID before saving.',
      });
      return;
    }
    try {
      await saveChannel(trimmed);
      toast({
        title: 'Shoutout channel saved',
        description: `Shoutouts will be posted to channel ${trimmed}.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save',
        description: 'Could not save channel to database.',
      });
    }
  }, [channelInput, toast, saveChannel]);

  const handleChannelClear = React.useCallback(async () => {
    try {
      await saveChannel('');
      setChannelInput('');
      toast({
      title: 'Shoutout channel cleared',
      description: 'Configure a new channel before posting shoutouts.',
    });
  }, [toast]);

  const activeChannelId = shoutoutChannelId.trim() || null;

  const usersCollectionRef = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return collection(firestore, 'servers', serverId, 'users');
  }, [firestore, serverId]);

  const { data: allUsers, isLoading: isLoadingUsers, error: usersError } =
    useCollection<UserProfile>(usersCollectionRef);

  // Debug logging
  React.useEffect(() => {
    console.log('[ShoutoutList] Users data:', {
      count: allUsers?.length ?? 0,
      isLoading: isLoadingUsers,
      hasError: !!usersError,
      error: usersError?.message,
      serverId,
    });
  }, [allUsers, isLoadingUsers, usersError, serverId]);

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
        <div className="mt-4 space-y-3 rounded-lg border border-dashed border-secondary bg-secondary/20 p-4">
          <div className="space-y-2">
            <Label htmlFor="shoutout-channel-id" className="text-sm font-medium">
              Discord Channel ID
            </Label>
            <Input
              id="shoutout-channel-id"
              placeholder="e.g. 123456789012345678"
              value={channelInput}
              onChange={(event) => setChannelInput(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleChannelSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Channel
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={handleChannelClear}
              disabled={!shoutoutChannelId}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Clear
            </Button>
            {activeChannelId ? (
              <Badge variant="secondary" className="ml-auto">
                Posting to: {activeChannelId}
              </Badge>
            ) : (
              <Badge variant="outline" className="ml-auto">
                No channel configured
              </Badge>
            )}
          </div>
        </div>
      </div>

      {isLoadingUsers && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
             {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[450px] w-full rounded-lg" />)}
        </div>
      )}
      {!isLoadingUsers && onlineUsers.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {onlineUsers.map((streamer) => (
            <OnlineStreamerCard
              key={streamer.discordUserId}
              streamer={streamer}
              serverId={serverId}
              channelId={activeChannelId}
            />
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
