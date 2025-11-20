import { unstable_noStore } from 'next/cache';
import ShoutoutGroupClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ShoutoutGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  unstable_noStore();
  const resolvedParams = await params;
  return <ShoutoutGroupClientPage />;
}
