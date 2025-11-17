/**
 * Client-side hook to access server configuration from Firestore
 * Replaces localStorage for ALL configuration storage
 */

import * as React from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useServerId } from './get-server-id';

type ConfigCache = Record<string, any>;

/**
 * Hook to read/write server configuration from Firestore
 * Path: servers/{serverId}/config/settings
 */
export function useServerConfig() {
  const firestore = useFirestore();
  const serverId = useServerId();
  const [config, setConfig] = React.useState<ConfigCache>({});
  const [isLoading, setIsLoading] = React.useState(true);

  // Load config on mount
  React.useEffect(() => {
    if (!firestore || !serverId) return;

    const loadConfig = async () => {
      try {
        const configRef = doc(firestore, 'servers', serverId, 'config', 'settings');
        const snapshot = await getDoc(configRef);
        
        if (snapshot.exists()) {
          setConfig(snapshot.data() as ConfigCache);
        }
      } catch (error) {
        console.error('[useServerConfig] Failed to load config:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [firestore, serverId]);

  // Get a config value
  const get = React.useCallback(
    (key: string, defaultValue?: any) => {
      return config[key] ?? defaultValue;
    },
    [config]
  );

  // Set a config value and save to Firestore
  const set = React.useCallback(
    async (key: string, value: any) => {
      if (!firestore || !serverId) return;

      try {
        const configRef = doc(firestore, 'servers', serverId, 'config', 'settings');
        const updates = { [key]: value };
        
        // Update local state
        setConfig((prev) => ({ ...prev, ...updates }));
        
        // Save to Firestore
        const snapshot = await getDoc(configRef);
        if (snapshot.exists()) {
          await updateDoc(configRef, updates);
        } else {
          await setDoc(configRef, updates);
        }
      } catch (error) {
        console.error(`[useServerConfig] Failed to set ${key}:`, error);
      }
    },
    [firestore, serverId]
  );

  // Set multiple config values
  const setMultiple = React.useCallback(
    async (updates: Record<string, any>) => {
      if (!firestore || !serverId) return;

      try {
        const configRef = doc(firestore, 'servers', serverId, 'config', 'settings');
        
        // Update local state
        setConfig((prev) => ({ ...prev, ...updates }));
        
        // Save to Firestore
        const snapshot = await getDoc(configRef);
        if (snapshot.exists()) {
          await updateDoc(configRef, updates);
        } else {
          await setDoc(configRef, updates);
        }
      } catch (error) {
        console.error('[useServerConfig] Failed to set multiple values:', error);
      }
    },
    [firestore, serverId]
  );

  return {
    config,
    isLoading,
    get,
    set,
    setMultiple,
    serverId,
  };
}

/**
 * Hook to get shoutout channel ID for a specific group
 * Replaces localStorage.getItem('shoutoutChannelId:...')
 */
export function useShoutoutChannel(groupKey: string) {
  const firestore = useFirestore();
  const serverId = useServerId();
  const [channelId, setChannelId] = React.useState<string>('');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!firestore || !serverId) return;

    const loadChannel = async () => {
      try {
        const serverRef = doc(firestore, 'servers', serverId);
        const snapshot = await getDoc(serverRef);
        
        if (snapshot.exists()) {
          const data = snapshot.data();
          const channels = data?.shoutoutChannels || {};
          setChannelId(channels[groupKey] || '');
        }
      } catch (error) {
        console.error('[useShoutoutChannel] Failed to load:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadChannel();
  }, [firestore, serverId, groupKey]);

  const saveChannel = React.useCallback(
    async (newChannelId: string) => {
      if (!firestore || !serverId) return;

      try {
        const serverRef = doc(firestore, 'servers', serverId);
        const snapshot = await getDoc(serverRef);
        const currentData = snapshot.exists() ? snapshot.data() : {};
        const currentChannels = currentData?.shoutoutChannels || {};
        
        const updates = {
          shoutoutChannels: {
            ...currentChannels,
            [groupKey]: newChannelId,
          },
        };

        if (snapshot.exists()) {
          await updateDoc(serverRef, updates);
        } else {
          await setDoc(serverRef, updates);
        }
        
        setChannelId(newChannelId);
      } catch (error) {
        console.error('[useShoutoutChannel] Failed to save:', error);
        throw error;
      }
    },
    [firestore, serverId, groupKey]
  );

  return {
    channelId,
    isLoading,
    saveChannel,
  };
}

/**
 * Hook to get calendar channel ID
 * Replaces localStorage.getItem('calendarChannelId')
 */
export function useCalendarChannel() {
  const firestore = useFirestore();
  const serverId = useServerId();
  const [channelId, setChannelId] = React.useState<string>('');

  React.useEffect(() => {
    if (!firestore || !serverId) return;

    const loadChannel = async () => {
      try {
        const configRef = doc(firestore, 'servers', serverId, 'config', 'settings');
        const snapshot = await getDoc(configRef);
        
        if (snapshot.exists()) {
          const data = snapshot.data();
          setChannelId(data?.calendarChannelId || '');
        }
      } catch (error) {
        console.error('[useCalendarChannel] Failed to load:', error);
      }
    };

    loadChannel();
  }, [firestore, serverId]);

  const saveChannel = React.useCallback(
    async (newChannelId: string) => {
      if (!firestore || !serverId) return;

      try {
        const configRef = doc(firestore, 'servers', serverId, 'config', 'settings');
        await updateDoc(configRef, { calendarChannelId: newChannelId });
        setChannelId(newChannelId);
      } catch (error) {
        console.error('[useCalendarChannel] Failed to save:', error);
      }
    },
    [firestore, serverId]
  );

  return {
    channelId,
    saveChannel,
  };
}
