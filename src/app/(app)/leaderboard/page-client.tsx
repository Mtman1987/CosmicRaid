'use client';

import * as React from 'react';
import { useServerId } from '@/lib/get-server-id';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Trophy, Medal, Award, Download } from 'lucide-react';
import { PointsConfigCard } from './_components/points-config';
import { LeaderboardChannelConfig } from './_components/leaderboard-channel-config';
import { useCollection, useFirestore } from '@/firebase';
import { collection, doc, getDoc, orderBy, query, limit } from 'firebase/firestore';
import type { UserProfile, LeaderboardEntry } from '@/lib/types';

type LeaderboardDisplayEntry = LeaderboardEntry & { user?: UserProfile, rank: number };

export default function LeaderboardPage() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const serverId = useServerId();
  const [leaderboardData, setLeaderboardData] = React.useState<LeaderboardDisplayEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  
  const leaderboardQuery = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return query(collection(firestore, 'servers', serverId, 'leaderboard'), orderBy('points', 'desc'), limit(50));
  }, [firestore, serverId]);

  const { data: rawLeaderboard, isLoading: isLoadingLeaderboard } = useCollection<LeaderboardEntry>(leaderboardQuery);

  // Debug logging
  React.useEffect(() => {
    console.log('[Leaderboard] serverId:', serverId);
    console.log('[Leaderboard] rawLeaderboard:', rawLeaderboard?.length, 'entries');
    console.log('[Leaderboard] isLoadingLeaderboard:', isLoadingLeaderboard);
  }, [serverId, rawLeaderboard, isLoadingLeaderboard]);

  const fetchAndCombineLeaderboardData = React.useCallback(async () => {
    if (!rawLeaderboard || !firestore || !serverId) {
      console.log('[Leaderboard] Skipping fetch - missing data:', { hasRawLeaderboard: !!rawLeaderboard, hasFirestore: !!firestore, hasServerId: !!serverId });
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const combinedData: LeaderboardDisplayEntry[] = [];
    let rank = 1;
    for (const entry of rawLeaderboard) {
        let userProfile: UserProfile | undefined = undefined;
        const userDocRef = doc(firestore, 'servers', serverId, 'users', entry.userProfileId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            userProfile = userDocSnap.data() as UserProfile;
        }
        combinedData.push({ ...entry, user: userProfile, rank });
        rank++;
    }
    setLeaderboardData(combinedData);
    setIsLoading(false);
  }, [rawLeaderboard, firestore, serverId]);

  React.useEffect(() => {
    fetchAndCombineLeaderboardData();
  }, [fetchAndCombineLeaderboardData]);

  const refreshLeaderboard = () => {
    fetchAndCombineLeaderboardData();
  }

  const downloadLeaderboardImage = async () => {
    try {
      const response = await fetch('/api/points/leaderboard-image');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `space-mountain-leaderboard-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Leaderboard Downloaded!",
          description: "The leaderboard image has been saved to your downloads.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Download Failed",
        description: "Could not download leaderboard image.",
      });
    }
  };
  
  const finalIsLoading = isLoading || isLoadingLeaderboard;

  return (
    <div className="container mx-auto p-5 flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-500 to-purple-700 bg-clip-text text-transparent">
            Leaderboard
          </h1>
          <p className="text-gray-400">Top performers on the server</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadLeaderboardImage}
            className="px-5 py-3 bg-transparent text-purple-500 border border-purple-500 rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 hover:bg-purple-500/10"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={refreshLeaderboard}
            disabled={finalIsLoading}
            className="px-5 py-3 bg-purple-500 text-white border-none rounded-lg text-sm font-semibold cursor-pointer flex items-center gap-2 hover:bg-purple-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {finalIsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-2">Rankings</h2>
          <p className="text-gray-400 text-sm mb-6">See who&apos;s leading the pack</p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="p-3 text-left w-20">Rank</th>
                  <th className="p-3 text-left">User</th>
                  <th className="p-3 text-right">Points</th>
                </tr>
              </thead>
              <tbody>
                {finalIsLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-800">
                      <td className="p-3 text-center">
                        <div className="w-8 h-8 bg-gray-800 rounded mx-auto animate-pulse" />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-800 rounded-full animate-pulse" />
                          <div>
                            <div className="w-32 h-4 bg-gray-800 rounded mb-1 animate-pulse" />
                            <div className="w-24 h-3 bg-gray-800 rounded animate-pulse" />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="w-16 h-6 bg-gray-800 rounded ml-auto animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : leaderboardData.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-gray-400 py-12">
                      No leaderboard entries yet
                    </td>
                  </tr>
                ) : (
                  leaderboardData.map((entry) => (
                    <tr key={entry.userProfileId} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="p-3 text-center text-lg font-bold">
                        {entry.rank === 1 && <span className="text-2xl">🥇</span>}
                        {entry.rank === 2 && <span className="text-2xl">🥈</span>}
                        {entry.rank === 3 && <span className="text-2xl">🥉</span>}
                        {entry.rank > 3 && <span>#{entry.rank}</span>}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-4">
                          {entry.user?.avatarUrl ? (
                            <Image
                              src={entry.user.avatarUrl}
                              alt={entry.user.username || 'User'}
                              width={40}
                              height={40}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-base font-bold">
                              {entry.user?.username?.charAt(0).toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{entry.user?.username || 'Unknown User'}</p>
                            <p className="text-xs text-gray-400">{entry.userProfileId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-mono text-lg">
                        {entry.points.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-col gap-8">
          <PointsConfigCard serverId={serverId} />
          <LeaderboardChannelConfig serverId={serverId} />
        </div>
      </div>
    </div>
  );
}
