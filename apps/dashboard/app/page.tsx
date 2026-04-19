import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrainCircuit, Shield, Activity, HardDrive, Key, Server } from "lucide-react"

export default function DashboardPage() {
  const stats = [
    { title: "Total Memories", value: "342", icon: BrainCircuit, color: "text-blue-400" },
    { title: "Active Apps", value: "8", icon: Shield, color: "text-green-400" },
    { title: "Vault Size", value: "4.2 MB", icon: HardDrive, color: "text-purple-400" },
    { title: "Avg Confidence", value: "0.89", icon: Activity, color: "text-amber-400" },
  ]

  return (
    <div className="flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out py-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-gradient sm:text-5xl">Vault Overview</h1>
        <p className="text-muted-foreground text-lg max-w-[600px]">
          Your personal AI memory vault is online. All data is encrypted locally using AES-256-GCM and fully under your control.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardContent className="p-6 flex flex-row items-center justify-between space-y-0">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-xl bg-white/5 border border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${stat.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Instance Details
            </CardTitle>
            <CardDescription>Information about your local edge node</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-sm">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Mode</span>
                <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded">local</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Encryption</span>
                <span className="font-mono text-xs">AES-256-GCM</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-muted-foreground">Protocol Version</span>
                <span className="font-mono text-xs">0.1.0</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-muted-foreground">Database</span>
                <span className="font-mono text-xs truncate max-w-[150px]">~/.omxp/vault.db</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-indigo-400" />
              Cryptographic Identity
            </CardTitle>
            <CardDescription>Your vault's public identifier</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 text-sm flex flex-col justify-center">
            <div className="space-y-2">
              <p className="text-muted-foreground">Vault ID</p>
              <code className="block p-3 rounded-md bg-black/40 border border-white/5 text-xs text-indigo-300 font-mono break-all shadow-inner">
                v_local_x7f9a8b1c2d3e4f5
              </code>
            </div>
            <div className="space-y-2 mt-4">
              <p className="text-muted-foreground">Public Key (Ed25519)</p>
              <code className="block p-3 rounded-md bg-black/40 border border-white/5 text-xs text-indigo-300 font-mono break-all shadow-inner">
                MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAElz3iY9R...
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
