"use client";
import * as React from "react";
import { Toaster as RadToaster } from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  return (
    <RadToaster.Provider swipeDirection="right">
      <RadToaster.Viewport className="fixed bottom-0 right-0 z-50 m-4 flex w-96 max-w-[100vw] flex-col gap-2 outline-none" />
    </RadToaster.Provider>
  );
}
