'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function DevSessionCard() {
  const [serverId, setServerId] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createSession = async () => {
    if (!serverId.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a Discord Server ID',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/debug-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: serverId.trim() })
      });

      const data = await response.json();

      if (response.ok && data.sessionId) {
        localStorage.setItem('sessionId', data.sessionId);
        localStorage.setItem('discordServerId', serverId.trim());
        
        toast({
          title: 'Success',
          description: 'Dev session created and saved to localStorage'
        });
        
        // Refresh the page to apply the session
        window.location.reload();
      } else {
        throw new Error(data.error || 'Failed to create session');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create session',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-orange-800">🔧 Dev Session</CardTitle>
        <CardDescription>
          Create a test session for development (bypasses Space Mountain auth)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="serverId">Discord Server ID</Label>
          <Input
            id="serverId"
            value={serverId}
            onChange={(e) => setServerId(e.target.value)}
            placeholder="Enter your Discord server ID"
          />
        </div>
        <Button 
          onClick={createSession} 
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Creating...' : 'Create Dev Session'}
        </Button>
      </CardContent>
    </Card>
  );
}