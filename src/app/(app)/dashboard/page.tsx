import { unstable_noStore } from 'next/cache';
import DashboardClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function DashboardPage() {
  unstable_noStore();
  return <DashboardClientPage />;
}
