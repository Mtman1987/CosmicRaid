import { unstable_noStore } from 'next/cache';
import LeaderboardClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LeaderboardPage() {
  unstable_noStore();
  return <LeaderboardClientPage />;
}
