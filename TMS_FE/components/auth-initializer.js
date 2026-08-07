"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { verifySession } from "@/store/authSlice";

export function AuthInitializer({ children }) {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector((state) => state.auth.initialized);

  useEffect(() => {
    if (!initialized) {
      dispatch(verifySession());
    }
  }, [dispatch, initialized]);

  return children;
}
