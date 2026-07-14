import { MarketsTable } from "@/components/lending/markets-table";
import { UtilizationChart } from "@/components/lending/utilization-chart";
import { EventFeed } from "@/components/events/event-feed";
import { Stat } from "@/components/dashboard/stat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Flame, Layers } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="container py-10">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Protocol Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Real-time overview of OpenLend markets and activity.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Layers} label="Total Value Locked" value="$12.4M" trend="+3.2%" />
        <Stat icon={Activity} label="24h Volume" value="$2.1M" trend="+11.4%" />
        <Stat icon={ArrowDownToLine} label="24h Wraps" value="312" trend="+22" />
        <Stat icon={ArrowUpFromLine} label="24h Unwraps" value="189" trend="-7" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Markets</CardTitle>
          </CardHeader>
          <CardContent>
            <MarketsTable />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <UtilizationChart />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle>Live activity</CardTitle>
            <Flame className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <EventFeed limit={20} compact />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open positions at risk</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="warn">Warn</TabsTrigger>
                <TabsTrigger value="liquidatable">Liquidatable</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-4 text-sm text-muted-foreground">
                Connect a wallet to see your positions.
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
