"use client";

import Link from "next/link";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SiteHeader() {
  const { isAuthenticated, user, logout, loading } = useAuth();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="flex flex-1 items-center">
        <h1 className="text-sm font-medium text-muted-foreground">
          Task Management System
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {loading ? (
          <span className="text-sm text-muted-foreground">Loading...</span>
        ) : isAuthenticated ? (
          <>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.full_name || user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              Logout
            </Button>
          </>
        ) : (
          <Button asChild size="sm">
            <Link href="/login">
              <LogIn className="size-4" />
              Login
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
