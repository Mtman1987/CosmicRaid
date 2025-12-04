'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Users, Loader2 } from 'lucide-react';

export function TestUserButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCreateTestUser = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/test-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: 'Success!',
          description: 'Test user created/updated. Check the header for avatar display.',
        });
      } else {
        throw new Error(result.error || 'Failed to create test user');
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create test user',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleCreateTestUser} 
      disabled={isLoading}
      className="w-full"
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Users className="mr-2 h-4 w-4" />
      )}
      Create/Update Test User
    </Button>
  );
}