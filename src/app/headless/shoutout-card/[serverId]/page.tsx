import { FirebaseComponentsProvider } from "@/firebase";

export const dynamic = 'force-dynamic';

export default async function HeadlessShoutoutCardPage({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ serverId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { serverId } = await params;
  const {
    streamer,
    title,
    game,
    viewers,
    avatar,
    thumbnail,
    live,
    mature,
    group
  } = await searchParams;

  const isLive = live === 'true';
  const isVip = group === 'vip';
  const isCommunity = group === 'community';
  const isMatureStream = mature === 'true';

  return (
    <FirebaseComponentsProvider>
      <div className="w-[960px] h-[540px] overflow-hidden">
        <main className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 w-full h-full flex flex-col">
        {/* Header */}
        <div className="w-full h-[60px] bg-black/60 border-b border-white/10 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={avatar as string} 
              alt={`${streamer} avatar`}
              className="w-10 h-10 rounded-full border-2 border-purple-400"
            />
            <div>
              <h1 className="text-3xl font-bold text-white">dYs? Captain {streamer}</h1>
              <div className="flex items-center gap-2">
                {isLive && (
                  <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-semibold animate-pulse">
                    dY"' LIVE
                  </span>
                )}
                <span className="text-purple-300 text-sm">dY`� {viewers} viewers</span>
              </div>
            </div>
          </div>
          <div className={`rounded-lg px-4 py-2 ${
            isVip 
              ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-400/30'
              : 'bg-gradient-to-r from-blue-500/20 to-green-500/20 border border-blue-400/30'
          }`}>
            <div className="text-sm font-bold text-purple-300">�-? HONORED CREW VIP</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1">
          <div className="w-[640px] h-[360px] relative bg-black">
            {isLive ? (
              <div className="relative w-full h-full">
                <iframe
                  src={`https://player.twitch.tv/?channel=${streamer}&parent=localhost&autoplay=true&muted=true&controls=false`}
                  className="w-full h-full"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                />
                <div className="absolute inset-0 pointer-events-none">
                  <video 
                    id="backup-video"
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    loop
                    style={{ display: 'none' }}
                  >
                    <source src={`https://usher.ttvnw.net/api/channel/hls/${streamer}.m3u8`} type="application/x-mpegURL" />
                  </video>
                </div>
                {isMatureStream && (
                  <div className="absolute top-3 left-3 bg-black/70 text-white text-xs font-semibold px-3 py-1 rounded-full border border-red-500/60 shadow-lg">
                    Mature Content
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-black/30 relative">
                <img 
                  src={thumbnail as string}
                  alt="Stream thumbnail"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="text-4xl mb-2">�?,�,?</div>
                    <div className="text-lg">Stream Offline</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="w-[320px] h-[360px] bg-black/60 border-l border-white/10 flex flex-col gap-4 p-4">
            <div>
              <p className={`text-2xl font-semibold ${
                isVip ? 'text-purple-300' : 'text-blue-300'
              }`}>
                {isVip ? 'Space Mountain VIP Fleet' : 'Space Mountain Community'}
              </p>
              <p className="text-white text-xl leading-relaxed">
                Space Mountain is a coalition of streamers uplifting each other through raids, shoutouts, and mission briefs.
                Honored Captains like {streamer} lead the crew every day.
              </p>
            </div>
            <div className="space-y-6 text-xl text-white">
              <div className="flex justify-between">
                <span className="text-purple-300">Game</span>
                <span>{game}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-purple-300">Viewers</span>
                <span>{viewers}</span>
              </div>
              <div>
                <span className="text-purple-300 block">Stream Title</span>
                <span className="line-clamp-3">{title}</span>
              </div>
            </div>
            <div className="rounded-md bg-black/40 p-6 border border-white/5">
              <p className="text-xl text-purple-300 font-semibold mb-2">Mission Log</p>
              <p className="text-xl text-white leading-relaxed">
                {isVip 
                  ? `"Captain ${streamer} is blazing through ${game} with stellar skill! Join this epic space adventure and reinforce their crew."`
                  : `"Community member ${streamer} is exploring ${game} with determination! Join their mission and help expand our galactic reach."`
                }
              </p>
            </div>
          </div>
        </div>

        {/* Bottom - Scrolling Content */}
        <div className="w-full h-[120px] bg-black/60 border-t border-white/10 overflow-hidden relative">
          <div id="scrolling-content" className="absolute w-full p-4 animate-vertical-marquee">
            {/* Mission Briefing */}
            <div className="border-b border-white/10 pb-4 mb-4">
              <div className="text-lg text-purple-300 mb-2 font-semibold">dYZ_ Strategic Mission Analysis:</div>
              <div className="text-white text-lg leading-relaxed">
                {isVip 
                  ? `"Commander ${streamer} has been specially selected by Space Mountain Command for this critical deep-space reconnaissance operation. Their proven expertise in ${game} combat systems and stellar navigation makes them the ideal candidate to explore these uncharted digital frontiers. This mission represents a significant opportunity for scientific discovery and territorial expansion. All Space Mountain personnel are strongly encouraged to provide tactical support and witness this historic expedition as it unfolds in real-time."`
                  : `"Space Mountain Community member ${streamer} has launched an exciting exploration mission in ${game}. Their enthusiasm and dedication to the community make this an excellent opportunity for collaborative discovery. All community members are invited to join this adventure and contribute to our shared galactic knowledge base. Together we explore new worlds and build lasting friendships across the digital cosmos."`
                }
              </div>
            </div>

            {/* Call to Action */}
            <div className="pb-4 mb-4">
              <div className="text-lg text-purple-300 mb-2 font-semibold">dYs? Enlistment Opportunity - Join the Mission:</div>
              <div className="text-white text-lg leading-relaxed">
                {isVip 
                  ? `"Attention all potential Space Mountain recruits! This is your exclusive opportunity to join Commander ${streamer}'s elite expedition team. Navigate directly to their command bridge and experience the unparalleled excitement of deep-space exploration. Become an integral part of the legendary Space Mountain community where every mission matters and every cadet contributes to our collective success. The cosmos awaits brave souls ready to push beyond the known universe - will you accept this call to adventure and claim your place among the stars?"`
                  : `"Calling all space explorers! Join community member ${streamer} on their current adventure and become part of the Space Mountain family. Experience the joy of collaborative exploration where every viewer adds to the fun and excitement. Our community thrives on friendship, support, and shared discoveries. Come aboard and help us build the most welcoming corner of the digital galaxy - your adventure starts now!"`
                }
              </div>
            </div>

            {/* Mission Link */}
            <div className="text-center">
              <div className="text-purple-300 text-lg font-semibold mb-2">
                dY"� Direct Communication Link: twitch.tv/{streamer}
              </div>
              <div className="text-purple-300 text-sm">
                "Exploring the infinite possibilities of the digital cosmos, one stream at a time."
              </div>
            </div>
          </div>
        </div>

      </main>
      </div>
    </FirebaseComponentsProvider>
  );
}
