export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  
  if (!token) {
    return Response.json({ error: 'No Discord token found' }, { status: 500 });
  }

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': `Bot ${token}` }
    });
    
    if (response.ok) {
      const data = await response.json();
      return Response.json({ success: true, botUser: data.username });
    } else {
      return Response.json({ 
        error: 'Token invalid', 
        status: response.status,
        tokenLength: token.length 
      }, { status: 401 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}