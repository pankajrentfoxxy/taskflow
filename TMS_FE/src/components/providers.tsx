'use client';

import { Toaster } from '@/components/ui/sonner';
import RealtimeProvider from '@/components/RealtimeProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      {children}
      <Toaster richColors closeButton position="top-right" />
    </RealtimeProvider>
  );
}
