'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send, Image, FileVideo } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function TestShoutoutCard() {
  const [channelId, setChannelId] = useState('');
  const [isGeneratingStatic, setIsGeneratingStatic] = useState(false);
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);
  const { toast } = useToast();

  const testUser = 'swordsmaneb';

  const handleTestStatic = async () => {
    if (!channelId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Channel ID Required',
        description: 'Please enter a Discord channel ID',
      });
      return;
    }

    setIsGeneratingStatic(true);
    try {
      const response = await fetch('/api/test/shoutout-static', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUser,
          channelId: channelId.trim(),
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: 'Static Shoutout Sent',
          description: `Test static shoutout for ${testUser} posted to channel`,
        });
      } else {
        throw new Error(result.error || 'Failed to send static shoutout');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Static Test Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingStatic(false);
    }
  };

  const handleTestGif = async () => {
    if (!channelId.trim()) {
      toast({
        variant: 'destructive',
        title: 'Channel ID Required',
        description: 'Please enter a Discord channel ID',
      });
      return;
    }

    setIsGeneratingGif(true);
    try {
      const response = await fetch('/api/test/shoutout-gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUser,
          channelId: channelId.trim(),
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({
          title: 'GIF Shoutout Sent',
          description: `Test GIF shoutout for ${testUser} posted to channel`,
        });
      } else {
        throw new Error(result.error || 'Failed to send GIF shoutout');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'GIF Test Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsGeneratingGif(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Test Shoutout Cards</CardTitle>
        <CardDescription>
          Generate test static and GIF shoutouts for {testUser} (VIP user currently live)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="test-channel-id">Discord Channel ID</Label>
          <Input
            id="test-channel-id"
            placeholder="Enter channel ID to post test shoutouts"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <Button
            onClick={handleTestStatic}
            disabled={isGeneratingStatic || !channelId.trim()}
            variant="outline"
          >
            {isGeneratingStatic ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Image className="mr-2 h-4 w-4" />
            )}
            Test Static Card
          </Button>
          
          <Button
            onClick={handleTestGif}
            disabled={isGeneratingGif || !channelId.trim()}
            variant="outline"
          >
            {isGeneratingGif ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileVideo className="mr-2 h-4 w-4" />
            )}
            Test GIF Card
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <p>• Static card: Community-style image shoutout</p>
          <p>• GIF card: VIP-style animated shoutout</p>
          <p>• Test user: {testUser} (currently live)</p>
        </div>
      </CardContent>
    </Card>
  );
}