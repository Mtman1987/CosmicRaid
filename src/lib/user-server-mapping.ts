'use server';

import { db } from '@/firebase/server-init';

export async function getServerIdForUser(userId: string): Promise<string | null> {
  try {
    const doc = await db.collection('userServerMappings').doc(userId).get();
    if (doc.exists) {
      return doc.data()?.serverId || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get server ID for user:', error);
    return null;
  }
}

export async function setServerIdForUser(userId: string, serverId: string): Promise<void> {
  await db.collection('userServerMappings').doc(userId).set({
    serverId,
    userId,
    updatedAt: new Date()
  });
}

export async function loginUser(prevState: any, formData: FormData) {
  try {
    const userId = formData.get('userId') as string;
    const serverId = formData.get('serverId') as string;
    
    if (!userId || !serverId) {
      return { status: 'error' as const, message: 'User ID and Server ID are required.' };
    }

    await setServerIdForUser(userId, serverId);
    await copySecretsToNewServer(serverId);
    
    try {
      await syncDiscordDataForServer(serverId);
    } catch (syncError) {
      console.warn('Discord sync failed during login:', syncError);
    }
    
    return { 
      status: 'success' as const, 
      message: 'Login successful! Discord data synced.',
      userId,
      serverId
    };
  } catch (error) {
    console.error('Login error:', error);
    return { status: 'error' as const, message: 'Login failed.' };
  }
}

export async function syncDiscordDataForServer(guildId: string): Promise<void> {
  const { getServerConfig } = await import('./config-service');
  const { db } = await import('@/firebase/server-init');
  const botToken = await getServerConfig(guildId, 'DISCORD_BOT_TOKEN');
  if (!botToken) throw new Error('Discord bot token not found');

  const headers = { Authorization: `Bot ${botToken}` };

  const serverResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers });
  if (!serverResponse.ok) throw new Error(`Failed to fetch server: ${await serverResponse.text()}`);
  const serverData = await serverResponse.json();

  const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers });
  if (!rolesResponse.ok) throw new Error(`Failed to fetch roles: ${await rolesResponse.text()}`);
  const rolesData = await rolesResponse.json();

  const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers });
  if (!channelsResponse.ok) throw new Error(`Failed to fetch channels: ${await channelsResponse.text()}`);
  const channelsData = await channelsResponse.json();

  let allMembers: any[] = [];
  let after: string | null = null;
  do {
    const url: string = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;
    const membersResponse: Response = await fetch(url, { headers });
    if (!membersResponse.ok) throw new Error(`Failed to fetch members: ${await membersResponse.text()}`);
    const membersData: any[] = await membersResponse.json();
    allMembers.push(...membersData);
    after = membersData.length === 1000 ? membersData[membersData.length - 1].user.id : null;
  } while (after);

  const batch = db.batch();
  
  const publicDiscordRef = db.collection('discords').doc(guildId);
  batch.set(publicDiscordRef, { serverId: guildId, serverName: serverData.name }, { merge: true });
  
  const serverRef = db.collection('servers').doc(guildId);
  batch.set(serverRef, { serverId: guildId, serverName: serverData.name }, { merge: true });
  
  const rolesRef = db.collection('servers').doc(guildId).collection('config').doc('roles');
  batch.set(rolesRef, { roles: rolesData.map((r: any) => r.name).filter((name: string) => name !== '@everyone') });
  
  const channelsRef = db.collection('servers').doc(guildId).collection('config').doc('channels');
  batch.set(channelsRef, { 
    channels: channelsData.filter((c: any) => c.type === 0).map((c: any) => ({ id: c.id, name: c.name })) 
  });
  
  allMembers.forEach((member: any) => {
    const memberRef = db.collection('servers').doc(guildId).collection('members').doc(member.user.id);
    batch.set(memberRef, {
      id: member.user.id,
      username: member.user.username,
      displayName: member.nick || member.user.global_name || member.user.username,
      roles: member.roles,
      joinedAt: member.joined_at,
      avatar: member.user.avatar,
      lastSeen: new Date()
    }, { merge: true });
  });
  
  await batch.commit();
}

async function copySecretsToNewServer(serverId: string): Promise<void> {
  try {
    const secretsRef = db.collection('servers').doc(serverId).collection('config').doc('secrets');
    const existingSecrets = await secretsRef.get();
    
    if (existingSecrets.exists) {
      return;
    }
    
    const secrets = {
      DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
      TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID || '',
      TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET || '',
      FREE_CONVERT_API_KEY: process.env.FREE_CONVERT_API_KEY || '',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
      DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
      DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
      DISCORD_APP_ID: process.env.DISCORD_APP_ID || '',
      DISCORD_PUBLIC_KEY: process.env.DISCORD_PUBLIC_KEY || '',
      PUPPETEER_SERVICE_URL: process.env.PUPPETEER_SERVICE_URL || '',
      GUILD_ID: serverId
    };
    
    await secretsRef.set(secrets);
  } catch (error) {
    console.error('Failed to copy secrets:', error);
  }
}