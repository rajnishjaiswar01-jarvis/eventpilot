'use client';

import { useEffect, Suspense } from 'react';
import { useEventStore } from '@/lib/stores/event-store';
import { Sidebar } from './sidebar';
import { MobileNav } from './mobile-nav';

function LoadingBar() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const isHydrated = useEventStore((s) => s.isHydrated);
  const hydrate = useEventStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <Suspense>
        <Sidebar />
      </Suspense>
      <main className="flex-1 min-h-screen pb-20 md:pb-0">
        {isHydrated ? children : <LoadingBar />}
      </main>
      <Suspense>
        <MobileNav />
      </Suspense>
    </>
  );
}
