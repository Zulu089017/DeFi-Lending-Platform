import { BridgeWidget } from "@/components/bridge/bridge-widget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BridgePage() {
  return (
    <div className="container py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Cross-chain bridge</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Wrap a token from another chain into a Stellar-native wTKN — or unwrap back to your source chain.
          </p>
        </div>
        <BridgeWidget />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Average bridge time</CardDescription>
              <CardTitle className="text-2xl">~45s</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Source confirmation + Stellar finality</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Bridge fee</CardDescription>
              <CardTitle className="text-2xl">0.10%</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Paid in wTKN at mint time</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Supported chains</CardDescription>
              <CardTitle className="text-2xl">3</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">Ethereum · Polygon · Solana</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
