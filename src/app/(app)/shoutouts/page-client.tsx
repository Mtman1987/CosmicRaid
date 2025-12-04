'use client';
import * as React from 'react';
import { collection } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { useServerId } from '@/lib/get-server-id';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import type { UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users, ArrowRight, RefreshCw, Zap, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { matchesGroup } from '@/lib/group-utils-client';

type GroupCardProps = {
  groupName: 'VIP' | 'Community' | 'Raid Train' | 'Raid Pile';
  description: string;
  href: string;
  users: UserProfile[] | undefined;
  isLoading: boolean;
};

const groupIconMap = {
    VIP: <Users className="h-8 w-8 text-yellow-400" />,
    Community: <Users className="h-8 w-8 text-blue-400" />,
    'Raid Train': <Users className="h-8 w-8 text-orange-400" />,
    'Raid Pile': <Users className="h-8 w-8 text-red-400" />,
}

function GroupCard({ groupName, description, href, users, isLoading }: GroupCardProps) {
    const memberCount = React.useMemo(() => {
        if (!users) return '...';
        return users.filter(u => matchesGroup(u.group, groupName)).length;
    }, [users, groupName]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-start gap-4">
        {groupIconMap[groupName]}
        <div>
          <CardTitle className="font-headline">{groupName}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="font-bold text-2xl">
            {isLoading ? <Skeleton className="h-8 w-16" /> : `${memberCount} Members`}
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full">
          <Link href={href}>
            Manage Group <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default function ShoutoutsPage() {
    const firestore = useFirestore();
    const serverId = useServerId();
    const [isUpdatingUsers, setIsUpdatingUsers] = React.useState(false);
    const [isPostingDiscord, setIsPostingDiscord] = React.useState(false);

    const usersCollectionRef = React.useMemo(() => {
        if (!firestore || !serverId) return null;
        return collection(firestore, 'servers', serverId, 'users');
    }, [firestore, serverId]);

    const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCollectionRef);

    const handleForceUpdateUsers = React.useCallback(async () => {
        setIsUpdatingUsers(true);
        try {
            const response = await fetch('/api/force-update-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Users updated:', result.message);
            }
        } catch (error) {
            console.error('Failed to update users:', error);
        } finally {
            setIsUpdatingUsers(false);
        }
    }, []);

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
                console.log('Posted to Discord successfully');
            }
        } catch (error) {
            console.error('Failed to post to Discord:', error);
        } finally {
            setIsPostingDiscord(false);
        }
    }, [serverId]);


  return (
    <div className="space-y-8">
      <PageHeader
        title="AI Shoutout Center"
        description="Manage your shoutout groups and generate AI-powered messages."
      >
        <div className="flex gap-2">
          <Button onClick={handleForceUpdateUsers} disabled={isUpdatingUsers} variant="secondary" size="sm">
            {isUpdatingUsers ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Update Users
          </Button>
          <Button onClick={handleForceDiscordPost} disabled={isPostingDiscord || !serverId} variant="secondary" size="sm">
            {isPostingDiscord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Post to Discord
          </Button>
        </div>
      </PageHeader>

      <div className="space-y-4">
        <h2 className="text-2xl font-headline text-primary">Group Management</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <GroupCard
            groupName="VIP"
            description="Your most valued supporters."
            href="/shoutouts/vip"
            users={allUsers}
            isLoading={isLoadingUsers}
          />
          <GroupCard
            groupName="Community"
            description="General members of your community."
            href="/shoutouts/community"
            users={allUsers}
            isLoading={isLoadingUsers}
          />
          <GroupCard
            groupName="Raid Train"
            description="Participants in scheduled raid trains."
            href="/shoutouts/raid-train"
            users={allUsers}
            isLoading={isLoadingUsers}
          />
          <GroupCard
            groupName="Raid Pile"
            description="Spontaneous group raids."
            href="/shoutouts/raid-pile"
            users={allUsers}
            isLoading={isLoadingUsers}
          />
        </div>
      </div>
    </div>
  );
}
