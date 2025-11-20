import { unstable_noStore } from 'next/cache';
import RankClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RankPage({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) {
  unstable_noStore();
  const resolvedParams = await params;
  return <RankClientPage />;
}
