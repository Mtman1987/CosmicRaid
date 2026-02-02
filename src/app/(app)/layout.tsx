'use client';

import React from 'react';
import {
  Sidebar,
  SidebarProvider,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { BotMessageSquare, Rocket } from 'lucide-react';
import { MainNav } from './_components/main-nav';
import { UserNav } from './_components/user-nav';
import { FirebaseComponentsProvider } from '@/firebase';
import { AuthGuard } from '@/components/auth-guard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseComponentsProvider>
      <AuthGuard>
        <SidebarProvider collapsible="icon">
          <div className="flex min-h-screen">
            <Sidebar className="border-r group">
              <SidebarHeader className="p-4">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 group-data-[collapsed=true]:justify-center"
                  prefetch={false}
                >
                  <BotMessageSquare className="h-8 w-8 text-primary" />
                  <h2 className="font-headline text-lg font-semibold tracking-tight group-data-[collapsed=true]:hidden">
                    Cosmic Raid
                  </h2>
                </Link>
              </SidebarHeader>
              <SidebarContent className="p-4">
                <MainNav />
              </SidebarContent>
              <SidebarFooter className="p-4 space-y-4">
                <UserNav />
                <SidebarSeparator />
                <div className="text-center text-xs text-muted-foreground group-data-[collapsed=true]:hidden">
                  Powered by mtman1987 <Rocket className="inline h-3 w-3" />
                </div>
              </SidebarFooter>
            </Sidebar>
            <div className="flex flex-1 flex-col">
              <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
                <SidebarTrigger />
                <div className="flex-1">
                  {/* Future header content can go here, like a search bar */}
                </div>
              </header>
              <main className="flex-1 overflow-y-auto p-4 md:p-8">
                {children}
              </main>
            </div>
          </div>
        </SidebarProvider>
      </AuthGuard>
    </FirebaseComponentsProvider>
  );
}
