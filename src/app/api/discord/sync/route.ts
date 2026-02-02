'use server';
import { NextRequest, NextResponse } from 'next/server';

async function fetchFromDiscord(endpoint: string, botToken: string) {
    const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
        headers: { 'Authorization': `Bot ${botToken}` }
    });
    if (!response.ok) {
        throw new Error(`Discord API error for ${endpoint}: ${await response.text()}`);
    }
    return response.json();
}

export async function POST(request: NextRequest) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
        return NextResponse.json({ error: 'Discord Bot Token not configured on server.' }, { status: 500 });
    }

    try {
        const { guildId } = await request.json();
        if (!guildId) {
            return NextResponse.json({ error: 'Guild ID is required.' }, { status: 400 });
        }

        // Fetch all data concurrently
        const [serverData, rolesData, channelsData] = await Promise.all([
            fetchFromDiscord(`/guilds/${guildId}`, botToken),
            fetchFromDiscord(`/guilds/${guildId}/roles`, botToken),
            fetchFromDiscord(`/guilds/${guildId}/channels`, botToken)
        ]);

        // Paginate to get all members
        let allMembers: any[] = [];
        let after = '0';
        while (true) {
            const membersChunk = await fetchFromDiscord(`/guilds/${guildId}/members?limit=1000&after=${after}`, botToken);
            if (membersChunk.length === 0) break;
            allMembers.push(...membersChunk);
            after = membersChunk[membersChunk.length - 1].user.id;
        }
        
        return NextResponse.json({
            server: {
                serverId: serverData.id,
                serverName: serverData.name,
            },
            roles: rolesData,
            channels: channelsData,
            members: allMembers,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('[API /discord/sync]', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
