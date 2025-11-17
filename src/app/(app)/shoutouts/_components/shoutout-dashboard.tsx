'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore } from '@/firebase';
import { useServerId } from '@/lib/get-server-id';
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
import { Rocket, Users, Clock, Trophy, Send, WandSparkles, XCircle, CheckCircle, Loader2 } from 'lucide-react';
import { generateAllShoutoutsAction } from '@/lib/actions';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


// This component is currently not used on the main shoutouts page,
// as its logic has been integrated into the `[group]/page.tsx` for the community view.
// It is kept here for potential future use, e.g., for a global dashboard.

export function ShoutoutDashboard() {
  const firestore = useFirestore();
  const serverId = useServerId();

  const usersCollectionRef = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'servers', serverId, 'users');
  }, [firestore, serverId]);

  const { data: allUsers, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersCollectionRef);

  const { onlineUsers, offlineUsers } = React.useMemo(() => {
    const online: UserProfile[] = [];
    const offline: UserProfile[] = [];
    if (allUsers) {
        for (const user of allUsers) {
             if (user.isOnline) {
                online.push(user);
            } else {
                offline.push(user);
            }
        }
    }
    return { onlineUsers: online, offlineUsers: offline };
  }, [allUsers]);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-headline">Global Activity</h2>
      <p className="text-muted-foreground">This is a placeholder for future global shoutout statistics.</p>
       <Card>
        <CardHeader>
            <CardTitle>Online Users ({onlineUsers.length})</CardTitle>
        </CardHeader>
         <CardContent>
            {isLoadingUsers ? <Skeleton className="h-24 w-full" /> : <p>Display online user stats here.</p>}
        </CardContent>
       </Card>
        <Card>
        <CardHeader>
            <CardTitle>Offline Users ({offlineUsers.length})</CardTitle>
        </CardHeader>
         <CardContent>
            {isLoadingUsers ? <Skeleton className="h-24 w-full" /> : <p>Display offline user stats here.</p>}
        </CardContent>
       </Card>
    </div>
  );
}
