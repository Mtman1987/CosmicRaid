'use client';

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import { FirebaseErrorEmitter } from '@/firebase/error-emitter';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  React.useEffect(() => {
    const emitter = FirebaseErrorEmitter.getInstance();

    const handleError = (error: any) => {
      console.error("Firebase Error:", error);
      toast({
        variant: 'destructive',
        title: error.title || 'Firebase Error',
        description: error.message || 'An unexpected error occurred.',
      });
    };

    emitter.on('error', handleError);

    return () => {
      emitter.off('error', handleError);
    };
  }, [toast]);

  return null; // This component does not render anything
}
