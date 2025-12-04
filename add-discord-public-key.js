// Script to add Discord Public Key to Firestore secrets
const { db } = require('./src/firebase/server-init');

async function addDiscordPublicKey() {
  const serverId = '1240832965865635881';
  const publicKey = '6a903d0ec86d3d1556aeb2a7ec1dd585ab35e9129d040a8149cdfb8ad4154561';
  
  try {
    // Add to globalConfig
    await db.collection('globalConfig').doc('discordBot').set({
      DISCORD_PUBLIC_KEY: publicKey
    }, { merge: true });
    
    // Also add to server-specific secrets
    await db.collection('servers').doc(serverId).collection('config').doc('secrets').set({
      DISCORD_PUBLIC_KEY: publicKey
    }, { merge: true });
    
    console.log('✅ Discord Public Key added to Firestore');
    console.log('Key:', publicKey);
    
  } catch (error) {
    console.error('❌ Error adding public key:', error);
  }
}

addDiscordPublicKey();