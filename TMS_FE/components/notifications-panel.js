"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPatch } from "@/lib/api";
import {
  disconnectNotificationSocket,
  getNotificationSocket,
} from "@/lib/socket";
import {
  formatNotificationTime,
  getNotificationIcon,
} from "@/lib/notification-utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function NotificationItem({ notification, onRead }) {
  const icon = getNotificationIcon(notification.type);
  const href =
    notification.project_id && notification.task_id
      ? `/projects/${notification.project_id}`
      : null;

  const content = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 transition-colors",
        !notification.is_read && "bg-muted/40",
        href && "hover:bg-muted/60",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm",
          icon.className,
        )}
      >
        {icon.glyph}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{notification.title}</p>
        {notification.message ? (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {notification.message}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">
          {formatNotificationTime(notification.created_at)}
        </p>
      </div>
    </div>
  );

  async function handleClick() {
    if (!notification.is_read) {
      await onRead(notification.notification_id);
    }
  }

  if (href) {
    return (
      <Link href={href} onClick={handleClick} className="block border-b last:border-b-0">
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="block w-full border-b text-left last:border-b-0"
    >
      {content}
    </button>
  );
}

export function NotificationsPanel() {
  const { token, isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;

    try {
      const data = await apiGet("/notifications/unread-count", { token });
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      setUnreadCount(0);
    }
  }, [token]);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    try {
      const data = await apiGet("/notifications?limit=20", { token });
      setNotifications(data.notifications ?? []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectNotificationSocket();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    fetchUnreadCount();
    fetchNotifications();

    const socket = getNotificationSocket(token);

    function handleNewNotification(notification) {
      setNotifications((prev) => {
        const exists = prev.some(
          (item) => item.notification_id === notification.notification_id,
        );
        if (exists) return prev;
        return [notification, ...prev].slice(0, 20);
      });
      setUnreadCount((count) => count + 1);
    }

    socket?.on("notification:new", handleNewNotification);

    return () => {
      socket?.off("notification:new", handleNewNotification);
    };
  }, [isAuthenticated, token, fetchNotifications, fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  async function markRead(notificationId) {
    if (!token) return;

    try {
      await apiPatch(`/notifications/${notificationId}/read`, {}, { token });
      setNotifications((prev) =>
        prev.map((item) =>
          item.notification_id === notificationId
            ? { ...item, is_read: true, read_at: Date.now() }
            : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    if (!token || unreadCount === 0) return;

    try {
      await apiPatch("/notifications/read-all", {}, { token });
      setNotifications((prev) =>
        prev.map((item) => ({ ...item, is_read: true, read_at: Date.now() })),
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative" />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            Mark all read
          </Button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet
            </p>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.notification_id}
                notification={notification}
                onRead={markRead}
              />
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
