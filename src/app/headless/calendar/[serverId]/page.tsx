import { FirebaseComponentsProvider } from "@/firebase";
import { CalendarDisplay } from "@/app/(app)/calendar/_components/calendar-display";

export const dynamic = 'force-dynamic';

export default function HeadlessCalendarPage({ params }: { params: { serverId: string }}) {
    // This is a special, unlisted page used only for taking screenshots.
    // It renders the core CalendarDisplay component without any site layout.
    // We wrap it in the Firebase provider so it can fetch its own data.
    return (
        <FirebaseComponentsProvider>
            <main className="inline-block bg-background w-[600px]">
                <CalendarDisplay serverId={params.serverId} forScreenshot={true} />
            </main>
        </FirebaseComponentsProvider>
    )
}
