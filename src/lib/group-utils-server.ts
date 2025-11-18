'use server';

import { normalizeGroupValue } from './group-utils';

type GroupValue = string | number | null | undefined;

export async function isVipGroup(group: GroupValue, serverId?: string): Promise<boolean> {
  if (serverId) {
    const { db } = await import('@/firebase/server-init');
    try {
      const groupMappingsDoc = await db.collection('servers').doc(serverId).collection('config').doc('groupMappings').get();
      if (groupMappingsDoc.exists) {
        const mappings = groupMappingsDoc.data();
        const vipRoles = mappings?.vipRoles || [];
        if (typeof group === 'string' && vipRoles.includes(group)) {
          return true;
        }
      }
    } catch (error) {
      console.error('Error checking VIP role mappings:', error);
    }
  }
  return normalizeGroupValue(group) === 'vip';
}

export async function isCommunityGroup(group: GroupValue, serverId?: string): Promise<boolean> {
  if (serverId) {
    const { db } = await import('@/firebase/server-init');
    try {
      const groupMappingsDoc = await db.collection('servers').doc(serverId).collection('config').doc('groupMappings').get();
      if (groupMappingsDoc.exists) {
        const mappings = groupMappingsDoc.data();
        const communityRoles = mappings?.communityRoles || [];
        if (typeof group === 'string' && communityRoles.includes(group)) {
          return true;
        }
      }
    } catch (error) {
      console.error('Error checking Community role mappings:', error);
    }
  }
  return normalizeGroupValue(group) === 'community';
}

export async function getUserGroupFromRoles(userRoles: string[], serverId: string): Promise<string> {
  if (!Array.isArray(userRoles) || userRoles.length === 0) {
    return 'Community';
  }

  try {
    const { db } = await import('@/firebase/server-init');
    const groupMappingsDoc = await db.collection('servers').doc(serverId).collection('config').doc('groupMappings').get();
    
    if (groupMappingsDoc.exists) {
      const mappings = groupMappingsDoc.data();
      
      const vipRoles = mappings?.vipRoles || [];
      if (vipRoles.some((role: string) => userRoles.includes(role))) {
        return 'VIP';
      }
      
      const raidTrainRoles = mappings?.raidTrainRoles || [];
      if (raidTrainRoles.some((role: string) => userRoles.includes(role))) {
        return 'Raid Train';
      }
      
      const raidPileRoles = mappings?.raidPileRoles || [];
      if (raidPileRoles.some((role: string) => userRoles.includes(role))) {
        return 'Raid Pile';
      }
    }
  } catch (error) {
    console.error('Error getting user group from roles:', error);
  }
  
  return 'Community';
}
