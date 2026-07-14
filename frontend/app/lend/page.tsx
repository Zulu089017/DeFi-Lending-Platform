import { SupplyCard } from "@/components/lending/supply-card";
import { BorrowCard } from "@/components/lending/borrow-card";
import { MarketsTable } from "@/components/lending/markets-table";

export default function LendPage() {
  return (
    <div className="container py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Lend &amp; borrow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Supply collateral, borrow assets, and manage your positions.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <SupplyCard />
        <BorrowCard />
      </div>
      <div className="mt-10">
        <MarketsTable />
      </div>
    </div>
  );
}
