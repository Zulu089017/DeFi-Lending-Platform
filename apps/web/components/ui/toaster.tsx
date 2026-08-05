"use client";
import * as React from "react";
import { ToastProvider, ToastViewport } from "@radix-ui/react-toast";

export function Toaster() {
  return (
    <ToastProvider swipeDirection="right">
      <ToastViewport className="fixed bottom-0 right-0 z-50 m-4 flex w-96 max-w-[100vw] flex-col gap-2 outline-none" />
    </ToastProvider>
  );
}
