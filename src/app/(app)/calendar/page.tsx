import dynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CalendarClientPage = dynamic(() => import('./page-client'), {
  ssr: false,
});

export default function CalendarPage() {
  return <CalendarClientPage />;
}
