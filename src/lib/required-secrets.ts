'use server'

/**
 * List of all secrets required for the app to function
 */
export const REQUIRED_SECRETS = {
  // Essential for Discord operations
  DISCORD_BOT_TOKEN: {
    required: true,
    description: 'Discord bot token for API access',
    example: 'MTxxxxxxxxxxxxxxxxxxxxx.xxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  DISCORD_CLIENT_ID: {
    required: true,
    description: 'Discord application client ID',
    example: '1234567890123456789'
  },
  DISCORD_CLIENT_SECRET: {
    required: true,
    description: 'Discord application client secret',
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  DISCORD_APP_ID: {
    required: true,
    description: 'Discord application ID',
    example: '1234567890123456789'
  },
  DISCORD_PUBLIC_KEY: {
    required: true,
    description: 'Discord application public key',
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  
  // Optional but recommended
  TWITCH_CLIENT_ID: {
    required: false,
    description: 'Twitch application client ID for stream integration',
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  TWITCH_CLIENT_SECRET: {
    required: false,
    description: 'Twitch application client secret',
    example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
  },
  FREE_CONVERT_API_KEY: {
    required: false,
    description: 'FreeConvert API key for GIF conversion fallback',
    example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
  },
  GEMINI_API_KEY: {
    required: false,
    description: 'Google Gemini API key for AI content generation',
    example: 'AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  },
  PUPPETEER_SERVICE_URL: {
    required: false,
    description: 'Local Puppeteer service URL for screenshots',
    example: 'http://localhost:3300'
  }
}

/**
 * Get list of missing required secrets for a server
 */
export async function getMissingSecrets(serverId: string): Promise<string[]> {
  const { getServerConfig } = await import('./config-service')
  const missing: string[] = []
  
  for (const [key, config] of Object.entries(REQUIRED_SECRETS)) {
    if (config.required) {
      try {
        const value = await getServerConfig(serverId, key)
        if (!value || value.trim() === '') {
          missing.push(key)
        }
      } catch (error) {
        missing.push(key)
      }
    }
  }
  
  return missing
}

/**
 * Action to check what secrets are missing
 */
export async function checkRequiredSecrets(prevState: any, formData: FormData) {
  try {
    const userId = formData.get('userId') as string
    const serverId = formData.get('serverId') as string
    
    if (!userId || !serverId) {
      return { status: 'error' as const, message: 'User ID and Server ID required' }
    }

    const missing = await getMissingSecrets(serverId)
    
    if (missing.length === 0) {
      return { 
        status: 'success' as const, 
        message: 'All required secrets are configured!',
        missing: []
      }
    } else {
      return { 
        status: 'warning' as const, 
        message: `Missing ${missing.length} required secrets`,
        missing,
        secretsInfo: REQUIRED_SECRETS
      }
    }
  } catch (error) {
    return { 
      status: 'error' as const, 
      message: error instanceof Error ? error.message : 'Failed to check secrets' 
    }
  }
}