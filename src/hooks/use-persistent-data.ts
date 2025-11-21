/**
 * Hook to ensure all persistent data is loaded before rendering components
 * This prevents the "reset" issue where data appears to be lost on page refresh
 */

import * as React from 'react';
import { useServerConfig, useShoutoutChannel } from '@/lib/use-server-config';
import { useDoc, useFirestore } from '@/firebase';
import { useServerId } from '@/lib/get-server-id';
import { doc } from 'firebase/firestore';

export function usePersistentData() {
  const serverId = useServerId();
  const firestore = useFirestore();
  
  // Load server config
  const { config, isLoading: configLoading } = useServerConfig();
  
  // Load admin roles
  const adminRolesRef = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return doc(firestore, 'servers', serverId, 'config', 'settings');
  }, [firestore, serverId]);
  
  const { data: adminRolesData, isLoading: adminRolesLoading } = useDoc<{ adminRoles?: string[] }>(adminRolesRef);
  
  // Load channel settings
  const channelsRef = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return doc(firestore, 'servers', serverId, 'config', 'channels');
  }, [firestore, serverId]);
  
  const { data: channelsData, isLoading: channelsLoading } = useDoc<Record<string, string>>(channelsRef);
  
  // Load VIP channel specifically
  const { channelId: vipChannelId, isLoading: vipChannelLoading } = useShoutoutChannel('vip');
  
  // Load role mappings
  const roleMappingsRef = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return doc(firestore, 'servers', serverId, 'config', 'groupMappings');
  }, [firestore, serverId]);
  
  const { data: roleMappingsData, isLoading: roleMappingsLoading } = useDoc<{
    vipRoles?: string[];
    raidPileRoles?: string[];
  }>(roleMappingsRef);
  
  const isLoading = configLoading || adminRolesLoading || channelsLoading || vipChannelLoading || roleMappingsLoading;
  
  const persistentData = React.useMemo(() => ({
    serverConfig: config,
    adminRoles: adminRolesData?.adminRoles || [],
    channelSettings: channelsData || {},
    vipChannelId,
    roleMappings: {
      vipRoles: roleMappingsData?.vipRoles || [],
      raidPileRoles: roleMappingsData?.raidPileRoles || []
    }
  }), [config, adminRolesData, channelsData, vipChannelId, roleMappingsData]);
  
  return {
    data: persistentData,
    isLoading,
    serverId
  };
}

/**
 * Hook specifically for VIP list persistence
 */
export function useVipListPersistence() {
  const { data, isLoading } = usePersistentData();
  
  return {
    vipRoles: data.roleMappings.vipRoles,
    vipChannelId: data.vipChannelId,
    isLoading
  };
}

/**
 * Hook specifically for channel mappings persistence
 */
export function useChannelMappingsPersistence() {
  const { data, isLoading } = usePersistentData();
  
  return {
    channelSettings: data.channelSettings,
    isLoading
  };
}

/**
 * Hook specifically for admin roles persistence
 */
export function useAdminRolesPersistence() {
  const { data, isLoading } = usePersistentData();
  
  return {
    adminRoles: data.adminRoles,
    isLoading
  };
}