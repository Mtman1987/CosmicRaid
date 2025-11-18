'use server';

import { db } from '@/firebase/server-init';
import { normalizeGroupValue, toCanonicalGroup } from './group-utils';
import { isVipGroup, isCommunityGroup } from './group-utils-server';

interface UserRoleInfo {
  userId: string;
  username: string;
  roles: string[];
  currentGroup: string;
  suggestedGroup: string;
  needsUpdate: boolean;
}

/**
 * Analyze user roles and suggest proper group assignments
 */
export async function analyzeUserRoles(serverId: string): Promise<UserRoleInfo[]> {
  try {
    const usersSnapshot = await db
      .collection('servers')
      .doc(serverId)
      .collection('users')
      .get();

    if (usersSnapshot.empty) {
      console.log('[RoleAnalysis] No users found');
      return [];
    }

    const analysis: UserRoleInfo[] = [];

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      const userId = doc.id;
      const username = userData.username || 'Unknown';
      const roles = userData.roles || [];
      const currentGroup = userData.group || 'Community';

      // Determine suggested group based on roles
      const suggestedGroup = determineGroupFromRoles(roles);
      const needsUpdate = currentGroup !== suggestedGroup;

      analysis.push({
        userId,
        username,
        roles,
        currentGroup,
        suggestedGroup,
        needsUpdate
      });
    }

    return analysis.sort((a, b) => {
      // Sort by needs update first, then by group
      if (a.needsUpdate && !b.needsUpdate) return -1;
      if (!a.needsUpdate && b.needsUpdate) return 1;
      return a.suggestedGroup.localeCompare(b.suggestedGroup);
    });

  } catch (error) {
    console.error('[RoleAnalysis] Error analyzing roles:', error);
    return [];
  }
}

/**
 * Determine group based on Discord roles
 */
function determineGroupFromRoles(roles: string[]): string {
  if (!Array.isArray(roles)) return 'Community';

  const roleNames = roles.map(role => role.toLowerCase());

  // Check for VIP indicators
  const vipKeywords = ['vip', 'premium', 'supporter', 'patron', 'donor', 'captain', 'officer', 'mod', 'moderator'];
  const hasVipRole = vipKeywords.some(keyword => 
    roleNames.some(role => role.includes(keyword))
  );

  if (hasVipRole) {
    return 'VIP';
  }

  // Check for raid train/pile indicators
  const raidKeywords = ['raid', 'train', 'pile'];
  const hasRaidRole = raidKeywords.some(keyword => 
    roleNames.some(role => role.includes(keyword))
  );

  if (hasRaidRole) {
    if (roleNames.some(role => role.includes('train'))) {
      return 'Raid Train';
    }
    if (roleNames.some(role => role.includes('pile'))) {
      return 'Raid Pile';
    }
    return 'Raid Train'; // Default raid type
  }

  // Default to Community
  return 'Community';
}

/**
 * Auto-assign groups based on Discord roles
 */
export async function autoAssignGroups(serverId: string, dryRun: boolean = true): Promise<{
  updated: number;
  changes: Array<{
    username: string;
    oldGroup: string;
    newGroup: string;
    roles: string[];
  }>;
}> {
  try {
    const analysis = await analyzeUserRoles(serverId);
    const changes = analysis.filter(user => user.needsUpdate);

    if (changes.length === 0) {
      console.log('[RoleAssignment] No group changes needed');
      return { updated: 0, changes: [] };
    }

    if (dryRun) {
      console.log(`[RoleAssignment] DRY RUN: Would update ${changes.length} users`);
      changes.forEach(user => {
        console.log(`  ${user.username}: ${user.currentGroup} → ${user.suggestedGroup} (roles: ${user.roles.join(', ')})`);
      });
      return { 
        updated: 0, 
        changes: changes.map(user => ({
          username: user.username,
          oldGroup: user.currentGroup,
          newGroup: user.suggestedGroup,
          roles: user.roles
        }))
      };
    }

    // Apply changes
    const batch = db.batch();
    
    for (const user of changes) {
      const userRef = db
        .collection('servers')
        .doc(serverId)
        .collection('users')
        .doc(user.userId);

      batch.update(userRef, {
        group: user.suggestedGroup,
        groupUpdatedAt: new Date(),
        groupUpdatedBy: 'auto-assignment'
      });
    }

    await batch.commit();
    console.log(`[RoleAssignment] Updated ${changes.length} user groups`);

    return { 
      updated: changes.length, 
      changes: changes.map(user => ({
        username: user.username,
        oldGroup: user.currentGroup,
        newGroup: user.suggestedGroup,
        roles: user.roles
      }))
    };

  } catch (error) {
    console.error('[RoleAssignment] Error auto-assigning groups:', error);
    return { updated: 0, changes: [] };
  }
}

/**
 * Get group statistics for a server
 */
export async function getGroupStatistics(serverId: string): Promise<{
  total: number;
  byGroup: Record<string, number>;
  online: Record<string, number>;
  needsUpdate: number;
}> {
  try {
    const analysis = await analyzeUserRoles(serverId);
    
    const stats = {
      total: analysis.length,
      byGroup: {} as Record<string, number>,
      online: {} as Record<string, number>,
      needsUpdate: analysis.filter(u => u.needsUpdate).length
    };

    // Get online status
    const usersSnapshot = await db
      .collection('servers')
      .doc(serverId)
      .collection('users')
      .get();

    const onlineUsers = new Set();
    usersSnapshot.docs.forEach(doc => {
      if (doc.data().isOnline) {
        onlineUsers.add(doc.data().username);
      }
    });

    // Count by group
    analysis.forEach(user => {
      const group = user.currentGroup;
      stats.byGroup[group] = (stats.byGroup[group] || 0) + 1;
      
      if (onlineUsers.has(user.username)) {
        stats.online[group] = (stats.online[group] || 0) + 1;
      }
    });

    return stats;

  } catch (error) {
    console.error('[RoleAnalysis] Error getting statistics:', error);
    return { total: 0, byGroup: {}, online: {}, needsUpdate: 0 };
  }
}