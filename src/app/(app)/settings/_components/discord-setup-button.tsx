'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Settings, Loader2 } from 'lucide-react';

export function DiscordSetupButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSetupDiscord = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/add-public-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success!',
          description: 'Discord Public Key added to Firestore. Deploy code and set interactions URL in Discord Developer Portal.',
        });
      } else {
        throw new Error(result.error || 'Failed to setup Discord');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to setup Discord',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button 
        onClick={handleSetupDiscord} 
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Settings className="mr-2 h-4 w-4" />
        )}
        Add Discord Public Key
      </Button>
      <div className="text-sm text-muted-foreground">
        <p><strong>Next steps after clicking:</strong></p>
        <ol className="list-decimal list-inside space-y-1 mt-2">
          <li>Deploy your updated code</li>
          <li>Go to Discord Developer Portal</li>
          <li>Set Interactions Endpoint URL to:</li>
        </ol>
        <code className="text-xs bg-muted p-1 rounded mt-1 block">
          https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/api/discord/interactions
        </code>
      </div>
    </div>
  );
}