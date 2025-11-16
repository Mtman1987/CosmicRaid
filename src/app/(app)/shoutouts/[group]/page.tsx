import { unstable_noStore } from 'next/cache';
import ShoutoutGroupClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function ShoutoutGroupPage({
  params,
}: {
  params: { group: string };
}) {
  unstable_noStore();
  return <ShoutoutGroupClientPage params={params} />;
}
