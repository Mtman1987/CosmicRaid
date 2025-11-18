'use client';

import * as React from 'react';
import { useServerId } from '@/lib/get-server-id';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PlayCircle, RefreshCw, Video, Download, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SpotlightData {
  streamerName: string;
  cardGifUrl: string;
  mp4Url?: string;
  lastUpdated: string;
  streamData: {
    title: string;
    game: string;
    viewers: number;
    avatarUrl: string;
  };
}

export function CommunitySpotlight() {
  const [spotlight, setSpotlight] = React.useState<SpotlightData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isConverting, setIsConverting] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const serverId = useServerId();

  const loadSpotlight = React.useCallback(async () => {
    if (!serverId) return;

    const response = await fetch('/api/community/spotlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Failed to load community spotlight');
    }

    const data = await response.json();
    setSpotlight(data.spotlight ?? null);
  }, [serverId]);

  React.useEffect(() => {
    if (!serverId) return;
    setIsLoading(true);
    loadSpotlight()
      .catch((error) => console.error('Error loading community spotlight:', error))
      .finally(() => setIsLoading(false));
  }, [serverId, loadSpotlight]);

  // Auto-polling is now handled by Cloud Scheduler / Uptime Robot
  // No need to call /api/auto-poll on page load

  const handleRefresh = async () => {
    if (!serverId) return;
    setIsRefreshing(true);
    try {
      await loadSpotlight();
    } catch (error) {
      console.error('Failed to refresh spotlight:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleConvertToGif = async () => {
    if (!spotlight?.mp4Url || !serverId) return;

    setIsConverting(true);
    try {
      const { convertClipToGif } = await import('@/lib/gif-conversion-service');
      const gifUrl = await convertClipToGif(
        spotlight.mp4Url,
        `spotlight_${spotlight.streamerName}_${Date.now()}`,
        spotlight.streamerName,
        600,
        'stream',
        { serverId: serverId ?? undefined }
      );

      if (gifUrl) {
        setSpotlight((prev) =>
          prev
            ? {
                ...prev,
                cardGifUrl: gifUrl,
              }
            : prev,
        );
      }
    } catch (error) {
      console.error('Failed to convert spotlight clip to GIF:', error);
    } finally {
      setIsConverting(false);
    }
  };

  const handleDeleteGif = async () => {
    if (!spotlight?.cardGifUrl || !serverId) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/spotlight/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId })
      });

      if (response.ok) {
        await handleRefresh();
      }
    } catch (error) {
      console.error('Failed to delete GIF:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const twitchUrl = spotlight ? `https://twitch.tv/${spotlight.streamerName}` : null;
  const lastUpdatedLabel = spotlight?.lastUpdated
    ? new Date(spotlight.lastUpdated).toLocaleString()
    : 'Never';

  if (isLoading) {
    return (
      <Card className="shadow-lg border border-secondary/40">
        <CardHeader>
          <CardTitle>Community Spotlight</CardTitle>
          <CardDescription>Loading the latest spotlight clip...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-64 rounded-md bg-muted animate-pulse" />
          <div className="h-4 rounded bg-muted animate-pulse w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!spotlight) {
    return (
      <Card className="shadow-lg border border-secondary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Community Spotlight</CardTitle>
              <CardDescription>No spotlight clip is available yet.</CardDescription>
            </div>
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            As soon as a community member goes live, their clip will appear here automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border border-secondary/40">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="h-6 w-6 text-primary" />
            Community Spotlight
          </CardTitle>
          <CardDescription>
            Featuring{' '}
            <a
              href={twitchUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              {spotlight.streamerName}
            </a>
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="secondary" onClick={handleConvertToGif} disabled={isConverting || !spotlight.mp4Url}>
            <Video className="mr-2 h-4 w-4" />
            {isConverting ? 'Optimizing...' : 'Regenerate GIF'}
          </Button>
          {spotlight.mp4Url && (
            <Button asChild variant="ghost">
              <a href={spotlight.mp4Url} target="_blank" rel="noopener noreferrer">
                <Download className="mr-2 h-4 w-4" />
                Download MP4
              </a>
            </Button>
          )}
          <Button variant="destructive" onClick={handleDeleteGif} disabled={isDeleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            {isDeleting ? 'Deleting...' : 'Delete GIF'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
          <Image
            src={spotlight.cardGifUrl}
            alt={`Spotlight clip for ${spotlight.streamerName}`}
            fill
            className="object-cover"
            unoptimized
            sizes="(max-width: 768px) 100vw, 960px"
          />
          <Badge className="absolute top-3 right-3" variant="secondary">
            {spotlight.streamData.game}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Image
              src={spotlight.streamData.avatarUrl}
              alt={spotlight.streamerName}
              width={48}
              height={48}
              className="rounded-full border"
            />
            <div>
              <p className="text-sm text-muted-foreground">Streamer</p>
              <p className="font-semibold">{spotlight.streamerName}</p>
            </div>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm text-muted-foreground">Viewers</p>
            <p className="text-xl font-semibold">{spotlight.streamData.viewers ?? '—'}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-sm text-muted-foreground">Last Updated</p>
            <p className="text-sm font-semibold">{lastUpdatedLabel}</p>
          </div>
        </div>

        <div className="rounded-md border p-4 bg-muted/40">
          <p className="text-sm text-muted-foreground">Now Playing</p>
          <h3 className="text-lg font-semibold">{spotlight.streamData.title}</h3>
          <p className="text-sm text-muted-foreground">Game: {spotlight.streamData.game}</p>
        </div>
      </CardContent>
    </Card>
  );
}
