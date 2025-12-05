'use client';

import * as React from 'react';
import { useParams, usePathname } from 'next/navigation';
import { useServerId } from '@/lib/get-server-id';
import { useShoutoutChannel } from '@/lib/use-server-config';
import { collection, doc, updateDoc, query, where, getDoc } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { UserProfile } from '@/lib/types';
import { Pencil, Trash2, ArrowLeft, Loader2, Rocket, Users, Clock, Trophy, Send, WandSparkles, XCircle, CheckCircle, PlayCircle, Star, PlusCircle, UserPlus, Layers, Save, RefreshCw, Zap } from 'lucide-react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { useActionState } from 'react';

import { generateAllShoutoutsAction, postShoutoutAction, updateUserGroupAction, updateUsersByRoleAction, triggerVipShoutoutsAction, updateShoutoutChannelAction } from '@/lib/actions';
import type { ShoutoutResult } from '@/lib/community-shoutout-service';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CommunitySpotlight } from './_components/community-spotlight';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { matchesGroup, slugToCanonicalGroup } from '@/lib/group-utils-client';
import { deriveStreamStats, getMediaPreviewUrl } from '@/lib/shoutout-display';
import { DataLoader } from '@/components/data-loader';
import { useVipListPersistence } from '@/hooks/use-persistent-data';


type PostShoutoutState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  message: string;
};

const initialPostState: PostShoutoutState = { status: 'idle', message: '' };

type VipActionState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  message: string;
};

const initialVipActionState: VipActionState = { status: 'idle', message: '' };

type ChannelActionState = {
  status: 'idle' | 'pending' | 'success' | 'error';
  message?: string;
};

const initialChannelActionState: ChannelActionState = { status: 'idle', message: '' };

function SendShoutoutButton({ idleLabel, pending }: { idleLabel: string; pending: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Send className="mr-2 h-4 w-4" />
      )}
      {pending ? 'Posting…' : idleLabel}
    </Button>
  );
}

function VipTriggerButton({ idleLabel, disabled, pending }: { idleLabel: string; disabled?: boolean; pending: boolean }) {
  return (
    <Button type="submit" className="w-full" variant="secondary" disabled={pending || disabled}>
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Star className="mr-2 h-4 w-4" />
      )}
      {pending ? 'Dispatching…' : idleLabel}
    </Button>
  );
}

// Simple row for Raid Train, Raid Pile
function StreamerRow({
  streamer,
  onEdit,
  onRemove,
}: {
  streamer: UserProfile;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b">
      <div className="relative">
        <Avatar>
          <AvatarImage src={streamer.avatarUrl} alt={streamer.username} />
          <AvatarFallback>{streamer.username.charAt(0)}</AvatarFallback>
        </Avatar>
        <div
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${
            streamer.isOnline ? 'bg-green-500' : 'bg-gray-400'
          }`}
        />
      </div>
      <div className="flex-1">
        <p className="font-medium">{streamer.username}</p>
        <p className="text-sm text-muted-foreground truncate">
          {streamer.isOnline ? streamer.topic || 'Online' : 'Offline'}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remove</span>
        </Button>
      </div>
    </div>
  );
}


// --- Components for the "Community" page layout ---

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className="w-full md:w-auto">
      {pending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <WandSparkles className="mr-2 h-4 w-4" />
      )}
      Generate Shoutouts for All Online Members
    </Button>
  );
}

function OnlineStreamerCard({
  streamer,
  serverId,
  channelId,
  currentPath,
}: {
  streamer: UserProfile;
  serverId: string | null;
  channelId: string | null;
  currentPath: string;
}) {
  const { toast } = useToast();
  const [state, postAction] = useActionState(postShoutoutAction, initialPostState);
  const stats = React.useMemo(() => deriveStreamStats(streamer), [streamer]);
  const previewUrl = React.useMemo(() => getMediaPreviewUrl(streamer), [streamer]);

  const payload = React.useMemo(() => {
    try {
      return streamer.dailyShoutout ? JSON.stringify(streamer.dailyShoutout) : null;
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
        title: 'Failed to post shoutout',
        description: state.message,
      });
    }
  }, [state, toast]);

  const handleDisabledPost = React.useCallback(() => {
    if (!streamer.dailyShoutout) {
      toast({
        variant: 'destructive',
        title: 'Missing content',
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
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black">
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
            {streamer.dailyShoutout?.description || 'Click "Generate Shoutouts" to create a unique message.'}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-4 p-4 pt-0">
         <div className="grid grid-cols-3 gap-2 w-full text-xs text-center">
            <div className="flex flex-col items-center gap-1 bg-secondary p-2 rounded-md">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{stats.viewerCount ?? 'GÇö'}</span>
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
          <form action={postAction} className="w-full">
            <input type="hidden" name="userId" value={localStorage.getItem('discordUserId') || ''} />
            <input type="hidden" name="serverId" value={serverId ?? ''} />
            <input type="hidden" name="channelId" value={channelId ?? ''} />
            <input type="hidden" name="streamerName" value={streamer.username} />
            <input type="hidden" name="payload" value={payload ?? ''} />
            <input type="hidden" name="currentPath" value={currentPath} />
            <SendShoutoutButton idleLabel="Post Individual Shoutout" pending={state.status === 'pending'} />
          </form>
        ) : (
          <Button type="button" variant="outline" className="w-full" onClick={handleDisabledPost}>
            <Send className="mr-2 h-4 w-4" />
            Post Individual Shoutout
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

function VipMemberCard({
    streamer,
    serverId,
    channelId,
    currentPath,
}: {
    streamer: UserProfile;
    serverId: string | null;
    channelId: string | null;
    currentPath: string;
}) {
    const { toast } = useToast();
    const [state, postAction] = useActionState(postShoutoutAction, initialPostState);
    const stats = React.useMemo(() => deriveStreamStats(streamer), [streamer]);
    const previewUrl = React.useMemo(() => getMediaPreviewUrl(streamer), [streamer]);

    const payload = React.useMemo(() => {
        try {
            return streamer.dailyShoutout ? JSON.stringify(streamer.dailyShoutout) : null;
        } catch (error) {
            console.error('Failed to serialise shoutout payload', error);
            return null;
        }
    }, [streamer.dailyShoutout]);

    const canPost = Boolean(serverId && channelId && payload);

    React.useEffect(() => {
        if (state.status === 'success') {
            toast({
                title: 'VIP shoutout posted',
                description: state.message,
            });
        } else if (state.status === 'error') {
            toast({
                variant: 'destructive',
                title: 'Failed to post VIP shoutout',
                description: state.message,
            });
        }
    }, [state, toast]);

    const handleDisabledPost = React.useCallback(() => {
        if (!streamer.dailyShoutout) {
            toast({
                variant: 'destructive',
                title: 'Missing content',
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
        }
    }, [channelId, serverId, streamer.dailyShoutout, streamer.username, toast]);

    return (
        <Card className="grid md:grid-cols-12 overflow-hidden">
            <div className="md:col-span-5 relative aspect-video md:aspect-auto w-full h-full group border-r-2 bg-black">
                 <Image
                    src={previewUrl}
                    alt={`Twitch clip from ${streamer.username}`}
                    fill
                    className="object-cover"
                    unoptimized
                    sizes="(max-width: 768px) 100vw, 480px"
                />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                    <PlayCircle className="h-12 w-12 text-white/70 group-hover:text-white group-hover:scale-110 transition-transform" />
                </div>
                <Badge className="absolute top-2 right-2" variant={streamer.isOnline ? 'destructive' : 'secondary'}>
                    {streamer.isOnline ? 'Live Stream' : 'Offline'}
                </Badge>
            </div>

            <div className="md:col-span-7 flex flex-col p-4">
                <CardHeader className="p-0">
                    <div className="flex items-start gap-4">
                         <Avatar className={`h-14 w-14 border-4 ${streamer.isOnline ? 'border-green-500' : 'border-gray-400'}`}>
                            <AvatarImage src={streamer.avatarUrl} alt={streamer.username} />
                            <AvatarFallback>{streamer.username.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <CardTitle className="flex items-center gap-2 text-2xl">
                               <Star className="h-6 w-6 text-yellow-400" />
                                <Link href={`https://twitch.tv/${streamer.username}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    {streamer.username}
                                </Link>
                            </CardTitle>
                            <Badge variant="secondary" className="mt-1 w-fit">
                                Honored Crew -+ Space Mountain VIP
                            </Badge>
                            <CardDescription className="truncate">
                               {streamer.isOnline ? streamer.topic || 'Streaming now!' : 'Offline'}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-4 flex-1 space-y-4">
                    <div className="bg-muted/50 p-3 rounded-md text-sm text-muted-foreground flex-1">
                        <p className="line-clamp-4">
                            {streamer.dailyShoutout?.description || 'A unique shoutout message will be generated when this VIP goes live.'}
                        </p>
                    </div>
                     <div className="grid grid-cols-3 gap-2 w-full text-xs text-center">
                        <div className="flex flex-col items-center gap-1 bg-secondary p-2 rounded-md">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold">{stats.viewerCount ?? 'GÇö'}</span>
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
                </CardContent>
                <CardFooter className="p-0 mt-4 flex-col gap-2">
                    {canPost ? (
                        <form action={postAction} className="w-full">
                            <input type="hidden" name="userId" value={localStorage.getItem('discordUserId') || ''} />
                            <input type="hidden" name="serverId" value={serverId ?? ''} />
                            <input type="hidden" name="channelId" value={channelId ?? ''} />
                            <input type="hidden" name="streamerName" value={streamer.username} />
                            <input type="hidden" name="payload" value={payload ?? ''} />
                            <input type="hidden" name="currentPath" value={currentPath} />
                            <SendShoutoutButton idleLabel="Post VIP Shoutout" pending={state.status === 'pending'} />
                        </form>
                    ) : (
                        <Button type="button" variant="outline" className="w-full" onClick={handleDisabledPost}>
                            <Send className="mr-2 h-4 w-4" />
                            Post VIP Shoutout
                        </Button>
                    )}
                    {state.status !== 'idle' && (
                        <p className="text-xs text-muted-foreground text-center w-full">{state.message}</p>
                    )}
                </CardFooter>
            </div>
        </Card>
    )
}

function FormSubmitButton({ children, pending, ...props }: React.ComponentProps<typeof Button> & { pending: boolean }) {
    return (
        <Button {...props} type="submit" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : children}
        </Button>
    )
}

// Dialog for adding/managing members to groups
function ManageMembersDialog({ groupName, communityMembers, allRoles, serverId, currentPath }: { groupName: string, communityMembers: UserProfile[], allRoles: string[], serverId: string, currentPath: string }) {
    const { toast } = useToast();
    const [open, setOpen] = React.useState(false);
    
    const [promoteState, promoteAction] = useActionState(updateUserGroupAction, { status: 'idle', message: '' });
    const [roleState, roleAction] = useActionState(updateUsersByRoleAction, { status: 'idle', message: '' });
    
    const promoteFormRef = React.useRef<HTMLFormElement>(null);
    const roleFormRef = React.useRef<HTMLFormElement>(null);

    React.useEffect(() => {
        if (promoteState.status === 'success') {
            toast({ title: 'Success!', description: promoteState.message });
            setOpen(false);
        } else if (promoteState.status === 'error') {
            toast({ variant: 'destructive', title: 'Error', description: promoteState.message });
        }
    }, [promoteState, toast]);
    
    React.useEffect(() => {
        if (roleState.status === 'success') {
            toast({ title: 'Success!', description: roleState.message });
            setOpen(false);
        } else if (roleState.status === 'error') {
            toast({ variant: 'destructive', title: 'Error', description: roleState.message });
        }
    }, [roleState, toast]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Manage Members
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manage {groupName} Members</DialogTitle>
                    <DialogDescription>
                        Assign members to the {groupName} group individually or by their Discord role.
                    </DialogDescription>
                </DialogHeader>

                {/* Promote Single Member (not for Community page) */}
                {groupName !== 'Community' && (
                    <form ref={promoteFormRef} action={promoteAction} className="space-y-4 rounded-lg border p-4">
                         <input type="hidden" name="currentUserId" value={localStorage.getItem('discordUserId') || ''} />
                         <input type="hidden" name="serverId" value={serverId} />
                         <input type="hidden" name="newGroup" value={groupName} />
                         <input type="hidden" name="currentPath" value={currentPath} />
                        <h3 className="font-semibold flex items-center gap-2"><UserPlus className="h-5 w-5" /> Promote a Member</h3>
                        <div className="grid gap-2">
                            <Label htmlFor="member-select">Select Member from Community</Label>
                            <Select name="userId" required>
                                <SelectTrigger id="member-select">
                                    <SelectValue placeholder="Choose a community member..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {communityMembers.length > 0 ? (
                                        communityMembers.map(member => (
                                            <SelectItem key={member.discordUserId || member.id} value={member.id || member.discordUserId}>
                                                {member.username} ({member.id ? 'ID: ' + member.id.slice(0, 8) + '...' : 'No ID'})
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <SelectItem value="loading" disabled>No community members found</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <FormSubmitButton pending={promoteState.status === 'pending'}>Promote to {groupName}</FormSubmitButton>
                        </DialogFooter>
                    </form>
                )}


                 {/* Assign by Role */}
                <form ref={roleFormRef} action={roleAction} className="space-y-4 rounded-lg border p-4">
                    <input type="hidden" name="currentUserId" value={localStorage.getItem('discordUserId') || ''} />
                    <input type="hidden" name="serverId" value={serverId} />
                    <input type="hidden" name="newGroup" value={groupName} />
                    <input type="hidden" name="currentPath" value={currentPath} />
                    <h3 className="font-semibold flex items-center gap-2"><Layers className="h-5 w-5" /> Assign Members by Role</h3>
                     <div className="grid gap-2">
                        <Label htmlFor="role-select">Select Discord Role</Label>
                        <Select name="roleName" required>
                             <SelectTrigger id="role-select">
                                <SelectValue placeholder="Choose a role..." />
                            </SelectTrigger>
                            <SelectContent>
                                {allRoles.length > 0 ? (
                                    allRoles.map(role => (
                                        <SelectItem key={role} value={role}>
                                            {role}
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="loading" disabled>No roles found. Sync server first.</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <FormSubmitButton pending={roleState.status === 'pending'}>Assign by Role</FormSubmitButton>
                    </DialogFooter>
                </form>

            </DialogContent>
        </Dialog>
    )
}


// Main component that renders different layouts based on group
export default function GroupDetailPage() {
  const [isUpdatingUsers, setIsUpdatingUsers] = React.useState(false);
  const [isPostingDiscord, setIsPostingDiscord] = React.useState(false);
  const params = useParams();
  const pathname = usePathname();
  const { toast } = useToast();
  const firestore = useFirestore();
  const serverId = useServerId();
  const { vipRoles, vipChannelId: persistentVipChannelId, isLoading: isVipDataLoading } = useVipListPersistence();

  const group = Array.isArray(params.group) ? params.group[0] : params.group;
  const groupName = React.useMemo(() => {
    const fallback =
      group
        ?.split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') || 'Group';
    return slugToCanonicalGroup(group ?? null) ?? fallback;
  }, [group]);
  const isCommunityPage = matchesGroup(group, 'Community');
  const isVipPage = matchesGroup(group, 'VIP');
  const channelGroupKey = React.useMemo(() => (group ?? 'default').toString(), [group]);
  const { channelId: shoutoutChannelId, saveChannel } = useShoutoutChannel(channelGroupKey);
  const [channelInput, setChannelInput] = React.useState('');
  
  React.useEffect(() => {
    if (shoutoutChannelId) {
      setChannelInput(shoutoutChannelId);
    }
  }, [shoutoutChannelId]);
  
  const channelReducer = React.useCallback(
    async (_state: ChannelActionState, formData: FormData) => {
      return await updateShoutoutChannelAction(_state, formData);
    },
    []
  );
  const [channelActionState, channelFormAction] = useActionState<ChannelActionState, FormData>(
    channelReducer,
    initialChannelActionState
  );

  const [editingStreamer, setEditingStreamer] = React.useState<UserProfile | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Conditionally declare the hook only for the community page
  type ShoutoutActionState =
    | { status: 'idle' | 'pending'; results: ShoutoutResult[]; error: undefined }
    | { status: 'success'; results: ShoutoutResult[]; error: undefined }
    | { status: 'error'; results: ShoutoutResult[]; error: string };

  const initialShoutoutState = React.useMemo<ShoutoutActionState>(
    () => ({ status: 'success', results: [], error: undefined }),
    [],
  );

  const generateAction = React.useMemo<
    (state: ShoutoutActionState, payload: FormData) => Promise<ShoutoutActionState>
  >(() => {
    if (isCommunityPage) {
      return generateAllShoutoutsAction as (
        state: ShoutoutActionState,
        payload: FormData,
      ) => Promise<ShoutoutActionState>;
    }
    return async (state: ShoutoutActionState, _payload?: FormData) => state;
  }, [isCommunityPage]);

  const [generateState, formAction] = useActionState<ShoutoutActionState, FormData>(
    generateAction,
    initialShoutoutState,
  );

  const vipDispatch = React.useMemo<
    (state: VipActionState, payload: FormData) => Promise<VipActionState>
  >(() => {
    if (isVipPage) {
      return triggerVipShoutoutsAction as (
        state: VipActionState,
        payload: FormData,
      ) => Promise<VipActionState>;
    }
    return async (state: VipActionState, _payload?: FormData) => state;
  }, [isVipPage]);

  const [vipActionState, vipFormAction] = useActionState<VipActionState, FormData>(
    vipDispatch,
    initialVipActionState,
  );

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
      const formData = new FormData();
      formData.append('userId', localStorage.getItem('discordUserId') || '');
      formData.append('serverId', serverId);
      formData.append('groupKey', channelGroupKey);
      formData.append('channelId', trimmed);
      formData.append('currentPath', pathname);
      channelFormAction(formData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to save',
        description: 'Could not save channel to database.',
      });
    }
  }, [channelInput, toast, serverId, channelGroupKey, pathname, channelFormAction, saveChannel]);

  const handleForceUpdateUsers = React.useCallback(async () => {
    setIsUpdatingUsers(true);
    try {
      const response = await fetch('/api/force-update-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        toast({
          title: 'Users Updated',
          description: result.message
        });
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update user statuses'
      });
    } finally {
      setIsUpdatingUsers(false);
    }
  }, [toast]);

  const handleForceDiscordPost = React.useCallback(async () => {
    if (!serverId) return;
    
    setIsPostingDiscord(true);
    try {
      const response = await fetch('/api/force-discord-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId })
      });
      
      if (response.ok) {
        toast({
          title: 'Posted to Discord',
          description: 'Shoutouts posted successfully'
        });
      } else {
        throw new Error('Discord posting failed');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Discord Post Failed',
        description: 'Could not post shoutouts to Discord'
      });
    } finally {
      setIsPostingDiscord(false);
    }
  }, [serverId, toast]);

  const handleChannelClear = React.useCallback(async () => {
    try {
      await saveChannel('');
      setChannelInput('');
      toast({
        title: 'Shoutout channel cleared',
        description: 'Configure a new channel before posting shoutouts.',
      });
      const formData = new FormData();
      formData.append('userId', localStorage.getItem('discordUserId') || '');
      formData.append('serverId', serverId);
      formData.append('groupKey', channelGroupKey);
      formData.append('channelId', '');
      formData.append('currentPath', pathname);
      channelFormAction(formData);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to clear',
        description: 'Could not clear channel from database.',
      });
    }
  }, [toast, serverId, channelGroupKey, pathname, channelFormAction, saveChannel]);

  const activeChannelId = React.useMemo(
    () => (shoutoutChannelId.trim().length > 0 ? shoutoutChannelId.trim() : null),
    [shoutoutChannelId],
  );

  // Fetch all users for the server once.
  const usersCollectionRef = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return collection(firestore, 'servers', serverId, 'users');
  }, [firestore, serverId]);

  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCollectionRef);

  // Memoize filtered lists based on allUsers
  const { members, onlineUsers, offlineUsers, communityMembers, allRoles } = React.useMemo(() => {
    let mutableUsers = allUsers ? [...allUsers] : [];

    const groupMembers = mutableUsers.filter((u) => matchesGroup(u.group, groupName));
    // Use actual online status for all groups
    const online = groupMembers.filter(u => u.isOnline || u.lastTwitchData?.isLive);
    const offline = groupMembers.filter(u => !u.isOnline && !u.lastTwitchData?.isLive);
    const community = mutableUsers.filter(u => matchesGroup(u.group, 'Community'));

    // Extract all unique roles from all users
    const roles = new Set<string>();
    mutableUsers.forEach(user => {
        user.roles?.forEach(role => roles.add(role));
    });
    const sortedRoles = Array.from(roles).sort();

    return { members: groupMembers, onlineUsers: online, offlineUsers: offline, communityMembers: community, allRoles: sortedRoles };
  }, [allUsers, groupName]);


  const handleEditClick = (streamer: UserProfile) => {
    setEditingStreamer(streamer);
  };

  const handleRemoveClick = async (streamer: UserProfile) => {
    if (!firestore || !serverId) return;
    if (!streamer.id) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Cannot reassign a user without a document ID.'
        });
        return;
    }

    try {
      const userDocRef = doc(firestore, 'servers', serverId, 'users', streamer.id);
      await updateDoc(userDocRef, { group: 'Community' });
      toast({
        title: 'Member Reassigned',
        description: `${streamer.username} has been moved back to the Community group.`,
      });
    } catch (error) {
      console.error('Failed to remove member from group:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not reassign member.',
      });
    }
  };

  const handleSaveChanges = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStreamer || !firestore || !serverId) return;

    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    const updatedUsername = formData.get('username') as string;
    const updatedTopic = formData.get('topic') as string;

    if (!editingStreamer.id) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Cannot update a user without a document ID.'
        });
        setIsSaving(false);
        return;
    }

    try {
        const userDocRef = doc(firestore, 'servers', serverId, 'users', editingStreamer.id);
        await updateDoc(userDocRef, {
            username: updatedUsername,
            topic: updatedTopic,
        });
        toast({
            title: "Success",
            description: "Streamer details updated."
        })
        setEditingStreamer(null);
    } catch (error) {
        console.error('Failed to save changes:', error);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not save changes.'
        });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <DataLoader>
      <div className="space-y-8">
        <PageHeader
          title={`${groupName} Group`}
          description={`Manage the members and shoutouts for the ${groupName} group.`}
        >
        <div className="flex gap-2 flex-wrap">
          {serverId && <ManageMembersDialog groupName={groupName} communityMembers={communityMembers} allRoles={allRoles} serverId={serverId} currentPath={pathname} />}
          <Button onClick={handleForceUpdateUsers} disabled={isUpdatingUsers} variant="secondary">
            {isUpdatingUsers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Update Users
          </Button>
          <Button onClick={handleForceDiscordPost} disabled={isPostingDiscord || !serverId} variant="secondary">
            {isPostingDiscord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Post to Discord
          </Button>
          <Button asChild variant="outline">
            <Link href="/shoutouts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Shoutouts Hub
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="rounded-lg border border-dashed border-secondary/50 bg-secondary/10 p-4 space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1 w-full">
            <Label htmlFor="shoutout-channel" className="text-sm font-medium">
              Discord Channel ID
            </Label>
            <Input
              id="shoutout-channel"
              placeholder="e.g. 123456789012345678"
              value={channelInput}
              onChange={(event) => setChannelInput(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
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
          </div>
          {channelActionState.status !== 'idle' && channelActionState.message && (
            <p
              className={`text-xs ${
                channelActionState.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
              }`}
            >
              {channelActionState.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {isVipPage
              ? 'VIP shoutouts will be posted to this channel.'
              : 'Shoutouts generated on this page will be posted to this channel.'}
          </span>
          <Badge variant={activeChannelId ? 'secondary' : 'outline'}>
            {activeChannelId ? `Posting to: ${activeChannelId}` : 'No channel configured'}
          </Badge>
        </div>
      </div>

      {isLoadingUsers && (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
            ))}
        </div>
      )}

      {/* RENDER VIP LAYOUT */}
      {!isLoadingUsers && isVipPage && (
        <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Manual VIP Dispatch</CardTitle>
                <CardDescription>
                  Force a fresh Twitch poll, refresh VIP spotlights, and post all currently live VIP shoutouts to Discord.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use this when you need an immediate refreshGÇöthis mirrors the automated cycle but only targets the VIP channel.
                </p>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <form action={vipFormAction} className="w-full space-y-3">
                  <input type="hidden" name="userId" value={localStorage.getItem('discordUserId') || ''} />
                  {serverId && <input type="hidden" name="serverId" value={serverId} />}
                  <input type="hidden" name="currentPath" value={pathname} />
                  <VipTriggerButton idleLabel="Sync & Post VIP Shoutouts" disabled={!serverId} pending={vipActionState.status === 'pending'} />
                </form>
                {vipActionState.status === 'error' && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{vipActionState.message}</AlertDescription>
                  </Alert>
                )}
                {vipActionState.status === 'success' && vipActionState.message && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{vipActionState.message}</AlertDescription>
                  </Alert>
                )}
              </CardFooter>
            </Card>

            {/* Online VIPs */}
            <div>
                <h2 className="text-2xl font-headline text-primary mb-2">
                    Online VIPs ({onlineUsers.length})
                </h2>
                <p className="text-muted-foreground">
                    Your most valued supporters, currently live. Each member has a featured clip.
                </p>
            </div>
            {onlineUsers.length > 0 ? (
                <div className="grid grid-cols-1 gap-6">
                    {onlineUsers.map(streamer => (
                        <VipMemberCard
                            key={streamer.id}
                            streamer={streamer}
                            serverId={serverId}
                            channelId={activeChannelId}
                            currentPath={pathname}
                        />
                    ))}
                </div>
            ) : (
                 <Card className="flex flex-col items-center justify-center py-20 text-center">
                    <CardHeader>
                        <Star className="mx-auto h-12 w-12 text-muted-foreground" />
                        <CardTitle className="mt-4">No VIPs Currently Live</CardTitle>
                        <CardDescription>When a VIP member goes live, their card will appear here.</CardDescription>
                    </CardHeader>
                </Card>
            )}

            <Separator />
            
            {/* Offline VIPs */}
            <Accordion type="single" collapsible className="w-full" defaultValue="offline-vips">
                <AccordionItem value="offline-vips">
                    <AccordionTrigger>
                        <div className="flex flex-col items-start">
                            <h2 className="text-2xl font-headline text-primary">
                                Offline VIPs ({offlineUsers.length})
                            </h2>
                            <p className="text-sm text-muted-foreground font-normal">
                                Click to see all offline VIP members.
                            </p>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                        <Card>
                            <CardContent className="p-4">
                                <ScrollArea className="h-72">
                                    {offlineUsers.length > 0 ? (
                                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-x-4 gap-y-6 pr-4">
                                        {offlineUsers.map((streamer) => (
                                            <OfflineStreamerTile key={streamer.id} streamer={streamer} />
                                        ))}
                                        </div>
                                    ) : (
                                        <p className="py-10 text-center text-muted-foreground">
                                        No offline VIPs found.
                                        </p>
                                    )}
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      )}


      {/* RENDER COMMUNITY LAYOUT */}
      {!isLoadingUsers && isCommunityPage && (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-headline text-primary mb-2">
              Live Dashboard
            </h2>
            <p className="text-muted-foreground">
              Generate and post shoutouts for all currently online members.
            </p>
          </div>
            
           <form action={formAction} className="space-y-6">
            {serverId && <input type="hidden" name="serverId" value={serverId} />}
            <input type="hidden" name="userId" value={localStorage.getItem('discordUserId') || ''} />
            <SubmitButton pending={generateState.status === 'pending'} />

            {generateState.status === 'error' && generateState.error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{generateState.error}</AlertDescription>
              </Alert>
            )}

            {generateState.status === 'success' && generateState.results && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Generation Results:</h3>
                {generateState.results.map((result, index) => (
                  <Alert key={index} variant={result.success ? 'default' : 'destructive'}>
                    {result.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <AlertTitle className='flex items-center gap-2'>
                      {result.streamerName}
                      <Badge variant={result.success ? 'secondary' : 'destructive'}>
                        {result.success ? 'Success' : 'Failed'}
                      </Badge>
                    </AlertTitle>
                    <AlertDescription>
                      {result.message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </form>

          {onlineUsers.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {onlineUsers.map((streamer) => (
                <OnlineStreamerCard
                  key={streamer.id}
                  streamer={streamer}
                  serverId={serverId}
                  channelId={activeChannelId}
                  currentPath={pathname}
                />
              ))}
            </div>
          ) : (
             <Card className="flex flex-col items-center justify-center py-20 text-center">
                <CardHeader>
                    <Rocket className="mx-auto h-12 w-12 text-muted-foreground" />
                    <CardTitle className="mt-4">All Quiet on the Frontier</CardTitle>
                    <CardDescription>No community members are currently online.</CardDescription>
                </CardHeader>
            </Card>
          )}

          {/* Community Spotlight always appears */}
          <CommunitySpotlight />

          <Separator />

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="offline-users">
              <AccordionTrigger>
                <div className="flex flex-col items-start">
                    <h2 className="text-2xl font-headline text-primary">
                      Offline Community Members ({offlineUsers.length})
                    </h2>
                    <p className="text-sm text-muted-foreground font-normal">
                      A list of all community members who are currently offline. Click to expand.
                    </p>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Card>
                  <CardContent className="p-4">
                    <ScrollArea className="h-72">
                      {offlineUsers.length > 0 ? (
                        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-x-4 gap-y-6 pr-4">
                          {offlineUsers.map((streamer) => (
                            <OfflineStreamerTile key={streamer.id} streamer={streamer} />
                          ))}
                        </div>
                      ) : (
                        <p className="py-10 text-center text-muted-foreground">
                          No offline users found.
                        </p>
                      )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      )}

      {/* RENDER SIMPLE MANAGEMENT LAYOUT for Raid Train, Raid Pile, etc. */}
      {!isLoadingUsers && !isCommunityPage && !isVipPage && (
        <Card>
          <CardHeader>
            <CardTitle>Group Members ({members.length})</CardTitle>
            <CardDescription>
              The following streamers are in the {groupName} group.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              {members.length > 0 ? members.map((streamer) => (
                <StreamerRow
                  key={streamer.id}
                  streamer={streamer}
                  onEdit={() => handleEditClick(streamer)}
                  onRemove={() => handleRemoveClick(streamer)}
                />
              )) : (
                  <p className="py-10 text-center text-muted-foreground">
                      No members found in this group.
                  </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {editingStreamer && (
        <Dialog
          open={!!editingStreamer}
          onOpenChange={() => setEditingStreamer(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Streamer</DialogTitle>
              <DialogDescription>
                Update the details for {editingStreamer.username}.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveChanges}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    defaultValue={editingStreamer.username}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="topic" className="text-right">
                    Topic
                  </Label>
                  <Input
                    id="topic"
                    name="topic"
                    defaultValue={editingStreamer.topic || ''}
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingStreamer(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </DataLoader>
  );
}

