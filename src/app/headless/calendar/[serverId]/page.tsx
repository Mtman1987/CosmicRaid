import { unstable_noStore } from 'next/cache';
import HeadlessCalendarClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function HeadlessCalendarPage() {
  unstable_noStore();
  return <HeadlessCalendarClientPage />;
}
