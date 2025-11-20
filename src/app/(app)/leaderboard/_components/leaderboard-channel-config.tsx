'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Save, Trash2, Send } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';


interface LeaderboardChannelConfigProps {
  serverId: string;
}

export function LeaderboardChannelConfig({ serverId }: LeaderboardChannelConfigProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [channelId, setChannelId] = React.useState('');
  const [channelInput, setChannelInput] = React.useState('');
  const [isPosting, setIsPosting] = React.useState(false);

  React.useEffect(() => {
    if (!firestore || !serverId) return;
    
    const fetchChannel = async () => {
      try {
        // Read from dedicated channelMapping doc to keep channels clean
        const mappingRef = doc(firestore, 'servers', serverId, 'config', 'channelMapping');
        const mappingSnap = await getDoc(mappingRef);

        if (mappingSnap.exists()) {
          const leaderboardChannel = mappingSnap.data()?.leaderboard;
          if (typeof leaderboardChannel === 'string' && leaderboardChannel.trim().length > 0) {
            setChannelId(leaderboardChannel);
            setChannelInput(leaderboardChannel);
          }
          return;
        }
      } catch (error) {
        // Silently handle permissions error - just means no channel configured yet
        console.log('[LeaderboardChannel] Could not load channel config (this is normal if not set up yet)');
      }
    };
    
    fetchChannel();
  }, [firestore, serverId]);

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
    
    if (!serverId || !firestore) {
      toast({
        variant: 'destructive',
        title: 'Server not selected',
        description: 'Set your Discord server ID in Settings first.',
      });
      return;
    }

    try {
      // Save to dedicated channelMapping doc to avoid polluting channel list
      const mappingRef = doc(firestore, 'servers', serverId, 'config', 'channelMapping');
      
      await setDoc(mappingRef, {
        leaderboard: trimmed,
        updatedAt: new Date()
      }, { merge: true });
      
      setChannelId(trimmed);
      toast({
        title: 'Leaderboard channel saved',
        description: `Leaderboard screenshots will be posted to channel ${trimmed}.`,
      });
    } catch (error) {
      console.error('Channel save error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to save channel',
        description: `Could not save the leaderboard channel configuration. ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [channelInput, serverId, firestore, toast]);

  const handleChannelClear = React.useCallback(async () => {
    if (!serverId || !firestore) return;

    try {
      const channelsRef = doc(firestore, 'servers', serverId, 'config', 'channels');
      
      await setDoc(channelsRef, {
        leaderboard: ''
      }, { merge: true });
      
      setChannelId('');
      setChannelInput('');
      toast({
        title: 'Leaderboard channel cleared',
        description: 'Configure a new channel before posting leaderboard screenshots.',
      });
    } catch (error) {
      console.error('Channel clear error:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to clear channel',
        description: `Could not clear the leaderboard channel configuration. ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }, [serverId, firestore, toast]);

  const handlePostLeaderboard = React.useCallback(async () => {
    if (!channelId.trim()) {
      toast({
        variant: 'destructive',
        title: 'No channel configured',
        description: 'Configure a Discord channel before posting the leaderboard.',
      });
      return;
    }

    setIsPosting(true);
    try {
      const response = await fetch('/api/points/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, channelId }),
      });

      if (response.ok) {
        toast({
          title: 'Leaderboard posted!',
          description: 'The leaderboard screenshot has been posted to Discord.',
        });
      } else {
        throw new Error('Failed to generate leaderboard');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to post leaderboard',
        description: 'Could not generate and post the leaderboard screenshot.',
      });
    } finally {
      setIsPosting(false);
    }
  }, [channelId, serverId, toast]);

  const activeChannelId = channelId.trim().length > 0 ? channelId.trim() : null;
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-xl font-bold mb-2">
        Leaderboard Channel Configuration
      </h2>
      <p className="text-gray-400 text-sm mb-6">
        Configure where leaderboard screenshots should be posted in Discord.
      </p>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="leaderboard-channel">
            Discord Channel ID
          </Label>
          <Input
            id="leaderboard-channel"
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
            disabled={!channelId}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handlePostLeaderboard}
            disabled={!activeChannelId || isPosting}
          >
            <Send className="mr-2 h-4 w-4" />
            {isPosting ? 'Posting...' : 'Post Leaderboard'}
          </Button>
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <span className="text-sm text-gray-400">Leaderboard screenshots will be posted to this channel.</span>
          <Badge variant={activeChannelId ? 'secondary' : 'outline'}>
            {activeChannelId ? `Posting to: ${activeChannelId}` : 'No channel configured'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
