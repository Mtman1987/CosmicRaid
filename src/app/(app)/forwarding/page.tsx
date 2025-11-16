import { unstable_noStore } from 'next/cache';
import ForwardingClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ForwardingPage() {
  unstable_noStore();
  return <ForwardingClientPage />;
}
