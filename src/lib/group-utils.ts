type GroupValue = string | number | null | undefined;
type NormalizedGroup = 'vip' | 'community' | 'raid train' | 'raid pile';

const CANONICAL_LABELS: Record<NormalizedGroup, string> = {
  vip: 'VIP',
  community: 'Community',
  'raid train': 'Raid Train',
  'raid pile': 'Raid Pile',
};

const GROUP_SLUGS: Record<NormalizedGroup, string> = {
  vip: 'vip',
  community: 'community',
  'raid train': 'raid-train',
  'raid pile': 'raid-pile',
};

function normalizeGroupString(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function normalizeGroupValue(group: GroupValue): NormalizedGroup | null {
  if (typeof group === 'number') {
    if (group === 0) return 'vip';
    if (group === 1) return 'community';
  }

  if (typeof group === 'string') {
    const normalized = normalizeGroupString(group);
    if (!normalized) return null;

    if (normalized.startsWith('vip')) {
      return 'vip';
    }
    if (normalized.startsWith('community')) {
      return 'community';
    }
    if (normalized.startsWith('raid train') || normalized.startsWith('train')) {
      return 'raid train';
    }
    if (normalized.startsWith('raid pile') || normalized.startsWith('pile')) {
      return 'raid pile';
    }
  }

  return null;
}

export function toCanonicalGroup(group: GroupValue): string | null {
  const normalized = normalizeGroupValue(group);
  if (!normalized) {
    return typeof group === 'string' ? group : null;
  }
  return CANONICAL_LABELS[normalized];
}

export function groupSlugFromValue(group: GroupValue): string | null {
  const normalized = normalizeGroupValue(group);
  if (!normalized) return null;
  return GROUP_SLUGS[normalized];
}

export function slugToCanonicalGroup(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return toCanonicalGroup(slug);
}

export function matchesGroup(value: GroupValue, target: GroupValue): boolean {
  const normalizedValue = normalizeGroupValue(value);
  const normalizedTarget = normalizeGroupValue(target);
  if (!normalizedTarget) return false;
  return normalizedValue === normalizedTarget;
}

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

export function isVipGroupSync(group: GroupValue): boolean {
  return normalizeGroupValue(group) === 'vip';
}

export function isCommunityGroupSync(group: GroupValue): boolean {
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
