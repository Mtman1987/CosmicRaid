import { unstable_noStore } from 'next/cache';
import HeadlessLeaderboardClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HeadlessLeaderboardPage() {
  unstable_noStore();
  return <HeadlessLeaderboardClientPage />;
}
