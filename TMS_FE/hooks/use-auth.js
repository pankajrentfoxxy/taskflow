"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { login, logout } from "@/store/authSlice";

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, tokens, initialized, status, error } = useAppSelector(
    (state) => state.auth,
  );

  const loginUser = useCallback(
    async (credentials) => {
      const result = await dispatch(login(credentials));

      if (login.rejected.match(result)) {
        throw new Error(result.payload || "Login failed");
      }

      router.push("/");
      router.refresh();
      return result.payload;
    },
    [dispatch, router],
  );

  const logoutUser = useCallback(async () => {
    await dispatch(logout());
    router.push("/login");
    router.refresh();
  }, [dispatch, router]);

  return {
    user,
    token: tokens?.accessToken ?? null,
    tokens,
    loading: !initialized || status === "loading",
    isAuthenticated: Boolean(tokens?.accessToken),
    error,
    login: loginUser,
    logout: logoutUser,
  };
}
