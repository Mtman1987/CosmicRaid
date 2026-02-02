'use client';

import * as React from 'react';
import {
  collection,
  doc,
  getDoc,
  orderBy,
  query,
  limit,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { UserProfile, LeaderboardEntry } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy } from 'lucide-react';
import { FirebaseClientProvider } from '@/firebase';

type LeaderboardDisplayEntry = LeaderboardEntry & {
  user?: UserProfile;
  rank: number;
};

function LeaderboardForScreenshot({ serverId }: { serverId: string }) {
  const firestore = useFirestore();
  const [leaderboardData, setLeaderboardData] = React.useState<
    LeaderboardDisplayEntry[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const leaderboardQuery = useMemoFirebase(() => {
    if (!firestore || !serverId) return null;
    return query(
      collection(firestore, 'servers', serverId, 'leaderboard'),
      orderBy('points', 'desc'),
      limit(10)
    );
  }, [firestore, serverId]);

  const {
    data: rawLeaderboard,
    isLoading: isLoadingLeaderboard,
  } = useCollection<LeaderboardEntry>(leaderboardQuery);

  React.useEffect(() => {
    const fetchAndCombineLeaderboardData = async () => {
      if (!rawLeaderboard || !firestore || !serverId) return;

      setIsLoading(true);
      const combinedData: LeaderboardDisplayEntry[] = [];
      let rank = 1;
      for (const entry of rawLeaderboard) {
        let userProfile: UserProfile | undefined = undefined;
        const userDocRef = doc(
          firestore,
          'servers',
          serverId,
          'users',
          entry.userProfileId
        );
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          userProfile = userDocSnap.data() as UserProfile;
        }
        combinedData.push({ ...entry, user: userProfile, rank });
        rank++;
      }
      setLeaderboardData(combinedData);
      setIsLoading(false);
    };

    fetchAndCombineLeaderboardData();
  }, [rawLeaderboard, firestore, serverId]);

  return (
    <div className="w-[600px] bg-slate-900 text-white p-8 font-sans">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-yellow-400 tracking-wider">
          LEADERBOARD
        </h1>
        <p className="text-slate-400">Top 10 Community Contributors</p>
      </div>
      <div className="space-y-3">
        {leaderboardData.map((entry, index) => (
          <div
            key={entry.id}
            className={`flex items-center p-3 rounded-lg transition-all duration-300 ${
                index === 0 ? 'bg-yellow-500/20 border-2 border-yellow-500 transform scale-105 shadow-lg' :
                index === 1 ? 'bg-slate-500/20 border border-slate-500' :
                index === 2 ? 'bg-orange-500/20 border border-orange-500' :
                'bg-slate-800/50'
            }`}
          >
            <div className="w-12 text-center text-2xl font-bold text-slate-400">
               {entry.rank === 1 ? <Trophy className="w-8 h-8 text-yellow-400 mx-auto" /> :
                entry.rank === 2 ? <Trophy className="w-8 h-8 text-slate-400 mx-auto" /> :
                entry.rank === 3 ? <Trophy className="w-8 h-8 text-orange-400 mx-auto" /> :
                entry.rank}
            </div>
            <Avatar className="w-12 h-12 ml-4 border-2 border-slate-600">
              <AvatarImage
                src={entry.user?.avatarUrl}
                alt={entry.user?.username}
              />
              <AvatarFallback>{entry.user?.username?.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="ml-4 flex-1">
              <p className="font-semibold text-lg text-white">
                {entry.user?.username ?? 'Unknown User'}
              </p>
              <p className="text-sm text-slate-400">
                ID: {entry.userProfileId}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-yellow-400">
                {entry.points.toLocaleString()}
              </p>
              <p className="text-xs text-slate-500">POINTS</p>
            </div>
          </div>
        ))}
      </div>
       <div className="text-center mt-6 text-xs text-slate-600">
            Powered by Streamer's Hub
      </div>
    </div>
  );
}

export default function HeadlessLeaderboardPage({
  params,
}: {
  params: { serverId: string };
}) {
  return (
    <FirebaseClientProvider>
      <main className="inline-block bg-slate-900">
        <LeaderboardForScreenshot serverId={params.serverId} />
      </main>
    </FirebaseClientProvider>
  );
}
