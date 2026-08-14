'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { connectSocket, disconnectSocket, dispatchNotification, dispatchPresence, dispatchTaskChanged } from '@/lib/socket';
import { toast } from '@/lib/util';

type Me = {
  id: number;
  role: string;
};

export default function RealtimeBridge({
  me,
  onNotification,
  onAdminNotification,
}: {
  me: Me | null;
  onNotification: () => void;
  onAdminNotification?: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!me || pathname.startsWith('/login')) {
      disconnectSocket();
      return;
    }

    const socket = connectSocket();
    const isAdmin = ['ADMIN', 'CEO'].includes(me.role);

    const onNotify = (payload: { notification?: { title?: string; body?: string } }) => {
      onNotification();
      dispatchNotification(payload);
      if (!isAdmin) {
        const title = payload?.notification?.title;
        if (title) toast.info(title);
      }
    };

    const onAdminNotify = (payload: { title?: string; body?: string }) => {
      if (!isAdmin) return;
      onAdminNotification?.();
      onNotification();
      dispatchNotification(payload);
      if (payload?.title) toast.info(payload.title);
    };

    const onTaskChanged = (payload: unknown) => {
      dispatchTaskChanged(payload);
    };

    const onPresence = (payload: unknown) => {
      dispatchPresence(payload);
    };

    socket.on('notification:new', onNotify);
    socket.on('admin:notification', onAdminNotify);
    socket.on('task:changed', onTaskChanged);
    socket.on('presence:update', onPresence);

    return () => {
      socket.off('notification:new', onNotify);
      socket.off('admin:notification', onAdminNotify);
      socket.off('task:changed', onTaskChanged);
      socket.off('presence:update', onPresence);
      disconnectSocket();
    };
  }, [me, pathname, onNotification, onAdminNotification]);

  return null;
}
