"use client";
import { EventFeed } from "./event-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";

export function EventFeedPreview() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-stellar" />
          Live cross-chain events
        </CardTitle>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          streaming
        </span>
      </CardHeader>
      <CardContent>
        <EventFeed limit={8} compact />
      </CardContent>
    </Card>
  );
}
