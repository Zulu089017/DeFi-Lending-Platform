"use client";
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        success: "border-transparent bg-success/20 text-success",
        danger: "border-transparent bg-danger/20 text-danger",
        warning: "border-transparent bg-yellow-500/20 text-yellow-500",
        stellar: "border-transparent bg-stellar/20 text-stellar",
        ethereum: "border-transparent bg-ethereum/20 text-ethereum",
        polygon: "border-transparent bg-polygon/20 text-polygon",
        solana: "border-transparent bg-solana/20 text-solana",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
