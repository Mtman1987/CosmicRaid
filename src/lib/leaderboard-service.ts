'use server';

export async function generateLeaderboardGif(serverId: string): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const response = await fetch(`${tunnelUrl}/api/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/headless/leaderboard/${serverId}`,
        width: 600,
        height: 800,
        duration: 30000,
        format: 'gif'
      }),
      signal: AbortSignal.timeout(40000)
    });
    
    if (response.ok) {
      const { gifUrl } = await response.json();
      return gifUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function getUserRank(serverId: string, userId: string): Promise<number | null> {
  try {
    const { db } = await import('@/firebase/server-init');
    const snapshot = await db.collection('servers')
      .doc(serverId)
      .collection('leaderboard')
      .orderBy('totalPoints', 'desc')
      .get();
    
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const userIndex = users.findIndex(user => user.id === userId);
    return userIndex >= 0 ? userIndex + 1 : null;
  } catch (error) {
    return null;
  }
}

export async function generateLeaderboardGifFromPage(serverId: string): Promise<string | null> {
  return generateLeaderboardGif(serverId);
}