import { unstable_noStore } from 'next/cache';
import ShoutoutsClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ShoutoutsPage() {
  unstable_noStore();
  return <ShoutoutsClientPage />;
}
