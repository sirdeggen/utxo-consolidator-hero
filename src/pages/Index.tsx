import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  consolidate,
  type ConsolidationProgress,
  type ConsolidationResult,
} from "@/lib/consolidate";
import {
  Combine,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Copy,
} from "lucide-react";

const Index = () => {
  const [pk, setPk] = useState("");
  const [show, setShow] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ConsolidationProgress | null>(null);
  const [result, setResult] = useState<ConsolidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onRun = async () => {
    if (!pk.trim()) {
      toast({ title: "Private key required", description: "Paste a WIF or hex private key." });
      return;
    }
    setRunning(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const res = await consolidate(pk, setProgress);
      setResult(res);
      toast({ title: "Consolidation broadcast", description: `txid ${res.txid.slice(0, 16)}…` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setProgress({ stage: "error", message: msg });
    } finally {
      setRunning(false);
    }
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: "Copied" });
  };

  const pct =
    progress?.current && progress?.total
      ? Math.round((progress.current / progress.total) * 100)
      : progress?.stage === "done"
      ? 100
      : progress?.stage === "broadcasting"
      ? 95
      : progress?.stage === "signing"
      ? 85
      : progress?.stage === "building"
      ? 75
      : 0;

  return (
    <main className="min-h-screen px-4 py-12 md:py-20">
      <div className="mx-auto max-w-3xl space-y-10">
        {/* Header */}
        <header className="space-y-4 text-center">
          <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary font-mono text-xs tracking-wider uppercase">
            <Combine className="mr-1.5 h-3 w-3" /> BSV UTXO Tool
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
            <span className="text-gradient">Consolidate</span> your UTXOs
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Sweep every unspent output controlled by a BSV private key into a
            single P2PKH output paying yourself — fee-free, broadcast through
            Taal's ARC.
          </p>
        </header>

        {/* What this does */}
        <Card className="glass-card p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h2 className="font-semibold text-lg">What is a consolidation transaction?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A <strong className="text-foreground">consolidation transaction</strong> merges
                many small UTXOs back into a single, larger one belonging to the
                same owner. It cleans up wallet bloat, reduces future input
                handling cost, and helps the network by pruning tiny "dust"
                outputs from the UTXO set.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Per the{" "}
                <a
                  href="https://wiki.bitcoinsv.io/index.php/Dust_Limit"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  BSV Dust Limit wiki <ExternalLink className="h-3 w-3" />
                </a>
                , miners running default policy accept consolidation
                transactions <em>without requiring a fee</em>, provided they
                meet the consolidation rules: significantly more inputs than
                outputs, sufficient input confirmations, and the same owner on
                both sides. That's why we send <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">X-SkipFeeValidation: true</code> to ARC — so it
                forwards the tx to miners as a policy-accepted consolidation.
              </p>
            </div>
          </div>
        </Card>

        {/* Warning */}
        <Alert className="border-destructive/40 bg-destructive/5">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <AlertTitle>Your private key never leaves the browser</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Signing happens locally with @bsv/sdk. Only the signed raw transaction
            is sent to ARC. Still — only paste keys you control, and prefer a
            burner browser session.
          </AlertDescription>
        </Alert>

        {/* Form */}
        <Card className="glass-card p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="pk" className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Private Key (WIF or Hex)
            </Label>
            <div className="relative">
              <Input
                id="pk"
                type={show ? "text" : "password"}
                value={pk}
                onChange={(e) => setPk(e.target.value)}
                placeholder="L1aW4aubDFB7yfras2S1mN3bqg9..."
                className="font-mono pr-10 bg-input/60 border-border/60 focus-visible:ring-primary"
                disabled={running}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={onRun}
            disabled={running || !pk.trim()}
            className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 hover:shadow-glow transition-all font-semibold h-12 text-base"
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Working…
              </>
            ) : (
              <>
                <Combine className="mr-2 h-4 w-4" />
                Scan & Consolidate
              </>
            )}
          </Button>

          {progress && (
            <div className="space-y-2 pt-2">
              <div className="flex justify-between text-xs font-mono text-muted-foreground">
                <span className="uppercase tracking-wider">{progress.stage}</span>
                {progress.current && progress.total && (
                  <span>
                    {progress.current} / {progress.total}
                  </span>
                )}
              </div>
              <Progress value={pct} className="h-1.5" />
              <p className="text-sm text-muted-foreground">{progress.message}</p>
            </div>
          )}
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription className="font-mono text-xs break-all">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Result */}
        {result && (
          <Card className="glass-card p-6 space-y-5 border-accent/30">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-accent/15 p-2 text-accent">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Broadcast successful</h2>
                <p className="text-sm text-muted-foreground">
                  {result.inputCount} inputs swept · {result.totalSatoshis.toLocaleString()} sats
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div>
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Transaction ID
                </Label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="flex-1 font-mono text-xs bg-muted/50 rounded px-3 py-2 break-all">
                    {result.txid}
                  </code>
                  <Button size="icon" variant="ghost" onClick={() => copy(result.txid)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <a
                    href={`https://whatsonchain.com/tx/${result.txid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Button size="icon" variant="ghost">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
              <details className="group">
                <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  Raw transaction hex
                </summary>
                <code className="mt-2 block font-mono text-[10px] bg-muted/40 rounded p-3 break-all max-h-48 overflow-auto">
                  {result.rawTx}
                </code>
              </details>
              <details>
                <summary className="cursor-pointer text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  ARC response
                </summary>
                <pre className="mt-2 block font-mono text-[10px] bg-muted/40 rounded p-3 overflow-auto max-h-48">
                  {JSON.stringify(result.arcResponse, null, 2)}
                </pre>
              </details>
            </div>
          </Card>
        )}

        <footer className="text-center text-xs text-muted-foreground font-mono pt-8">
          Built with @bsv/sdk · WhatsOnChain · ARC by Taal
        </footer>
      </div>
    </main>
  );
};

export default Index;
