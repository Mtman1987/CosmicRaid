'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Megaphone,
  Calendar,
  Trophy,
  MessageSquare,
  Settings,
  Mountain,
} from 'lucide-react';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { NavItem } from '@/lib/types';
import { cn } from '@/lib/utils';

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: <LayoutDashboard />,
  },
  {
    title: 'AI Shoutouts',
    href: '/shoutouts',
    icon: <Megaphone />,
  },
  {
    title: 'Calendar',
    href: '/calendar',
    icon: <Calendar />,
  },
  {
    title: 'Leaderboard',
    href: '/leaderboard',
    icon: <Trophy />,
  },
  {
    title: 'Raid Pile (Coming Soon)',
    href: '/raid-pile',
    icon: <Mountain />,
  },
  {
    title: 'Messages (Coming Soon)',
    href: '/forwarding',
    icon: <MessageSquare />,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: <Settings />,
  },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              className={cn(
                'w-full justify-start',
                pathname === item.href &&
                  'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
              )}
              tooltip={item.title}
            >
              <Link href={item.href}>
                {item.icon}
                <span className="truncate">{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
