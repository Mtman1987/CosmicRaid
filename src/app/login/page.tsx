import { unstable_noStore } from 'next/cache';
import LoginClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function LoginPage() {
  unstable_noStore();
  return <LoginClientPage />;
}
