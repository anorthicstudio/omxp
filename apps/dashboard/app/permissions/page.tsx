"use client"

import { Shield, Key, AlertTriangle, ExternalLink, XCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const MOCK_GRANTS = [
  { id: "pg_1", app_id: "claude-demo", app_name: "Claude Integration Demo", scopes: ["read:all", "write:context"], granted_at: "2026-04-18", expires: "90 days" },
  { id: "pg_2", app_id: "openai-demo", app_name: "OpenAI Terminal Client", scopes: ["read:all", "write:context"], granted_at: "2026-04-19", expires: "89 days" },
  { id: "pg_3", app_id: "cursor", app_name: "Cursor IDE", scopes: ["read:skills", "read:context", "write:context"], granted_at: "2026-04-10", expires: "80 days" }
]

export default function PermissionsPage() {
  return (
    <div className="flex-1 flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            App Permissions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Control which applications have access to your memory vault.
          </p>
        </div>
        <Button variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Revoke All Access
        </Button>
      </div>

      <div className="grid gap-6">
        {MOCK_GRANTS.map((grant) => (
          <Card key={grant.id} className="overflow-hidden relative group">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary/50 to-indigo-500/50" />
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-col space-y-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    {grant.app_name}
                    <Badge variant="glass" className="font-mono text-xs text-muted-foreground">{grant.app_id}</Badge>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Key className="h-3 w-3" /> Granted on {grant.granted_at} • Expires in {grant.expires}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  <XCircle className="h-4 w-4 mr-2" />
                  Revoke
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-black/20 rounded-md p-3 border border-white/5">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Permitted Scopes</p>
                <div className="flex flex-wrap gap-2">
                  {grant.scopes.map(scope => {
                    const isWrite = scope.startsWith('write') || scope === 'admin';
                    return (
                      <span key={scope} className={`text-xs px-2 py-1 rounded border font-mono ${isWrite ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                        {scope}
                      </span>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {MOCK_GRANTS.length === 0 && (
          <div className="text-center p-12 border border-dashed border-white/10 rounded-xl glass-card text-muted-foreground">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No applications currently have access to your vault.</p>
          </div>
        )}
      </div>
    </div>
  )
}
