import { unstable_noStore } from 'next/cache';
import SettingsClientPage from './page-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function SettingsPage() {
  unstable_noStore();
  return <SettingsClientPage />;
}
