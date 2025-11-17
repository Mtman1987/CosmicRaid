'use server'

import { Buffer } from 'node:buffer'

type ForwardAttachment = {
  filename: string
  dataUrl: string
  description?: string
}

export interface ForwardMessagePayload {
  targetChannelId: string
  content?: string
  embeds?: any[]
  components?: any[]
  allowedMentions?: {
    parse?: string[]
    users?: string[]
    roles?: string[]
  }
  attachments?: ForwardAttachment[]
  messageReference?: {
    messageId: string
    channelId?: string
  }
}

function decodeAttachment({ dataUrl, filename, description }: ForwardAttachment, index: number) {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/)
  if (!match) {
    throw new Error(`Invalid data URL for attachment ${filename}.`)
  }
  const [, mime, base64] = match
  return {
    id: index,
    filename,
    description,
    mime,
    buffer: Buffer.from(base64, 'base64'),
  }
}

async function postMultipartMessage(
  botToken: string,
  channelId: string,
  payload: Record<string, unknown>,
  attachments: ReturnType<typeof decodeAttachment>[],
) {
  const formData = new FormData()
  formData.append('payload_json', JSON.stringify(payload))

  attachments.forEach((attachment, index) => {
    formData.append(
      `files[${index}]`,
      new Blob([attachment.buffer], { type: attachment.mime }),
      attachment.filename,
    )
  })

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Discord API responded with ${response.status}: ${errorText}`)
  }

  return response.json()
}

async function postJsonMessage(
  botToken: string,
  channelId: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Discord API responded with ${response.status}: ${errorText}`)
  }

  return response.json()
}

export async function forwardMessage({
  targetChannelId,
  content,
  embeds,
  components,
  allowedMentions,
  attachments,
  messageReference,
}: ForwardMessagePayload) {
  const botToken = await getSecret('DISCORD_BOT_TOKEN');
  if (!botToken) {
    throw new Error('DISCORD_BOT_TOKEN is not configured.')
  }

  if (!targetChannelId) {
    throw new Error('A targetChannelId is required to forward a message.')
  }

  const payload: Record<string, unknown> = {
    allowed_mentions: allowedMentions ?? { parse: [] },
  }

  if (typeof content === 'string' && content.length > 0) {
    payload.content = content
  }

  if (embeds?.length) {
    payload.embeds = embeds
  }

  if (components?.length) {
    payload.components = components
  }

  if (messageReference) {
    payload.message_reference = {
      message_id: messageReference.messageId,
      channel_id: messageReference.channelId ?? targetChannelId,
    }
  }

  if (attachments?.length) {
    const decodedAttachments = attachments.map(decodeAttachment)
    payload.attachments = decodedAttachments.map(({ id, filename, description }) => ({
      id,
      filename,
      description,
    }))
    return postMultipartMessage(botToken, targetChannelId, payload, decodedAttachments)
  }

  return postJsonMessage(botToken, targetChannelId, payload)
}
