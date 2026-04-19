"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, BrainCircuit, Lock, Globe, Plus, Trash2 } from "lucide-react"

// Mock Data
const MOCK_MEMORIES = [
  { id: "mem_1", type: "fact", value: "My name is Rafee, founder of Anorthic Studio", confidence: 1.0, tags: ["personal"], visibility: "shared", date: "2026-04-19" },
  { id: "mem_2", type: "preference", value: "I prefer concise technical answers", confidence: 0.9, tags: ["ai-interaction"], visibility: "shared", date: "2026-04-18" },
  { id: "mem_3", type: "fact", value: "I am building OMXP, an open AI memory protocol", confidence: 1.0, tags: ["project", "omxp"], visibility: "shared", date: "2026-04-15" },
  { id: "mem_4", type: "context", value: "Currently debugging the vault-server auth routes", confidence: 0.8, tags: ["current-task"], visibility: "private", date: "2026-04-19" },
  { id: "mem_5", type: "skill", value: "Expert in TypeScript, Next.js, and Node.js", confidence: 0.95, tags: ["technical"], visibility: "shared", date: "2026-04-10" },
]

export default function MemoryPage() {
  const [search, setSearch] = useState("")
  
  const filtered = MOCK_MEMORIES.filter(m => m.value.toLowerCase().includes(search.toLowerCase()) || m.type.includes(search.toLowerCase()))

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'fact': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'preference': return 'bg-pink-500/10 text-pink-400 border-pink-500/20'
      case 'context': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'skill': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  return (
    <div className="flex-1 flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient flex items-center gap-2">
            <BrainCircuit className="h-8 w-8 text-primary" />
            Memory Units
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage the context and data stored in your vault.
          </p>
        </div>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Memory
        </Button>
      </div>

      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search memories by value or type..." 
              className="w-full bg-black/20 border border-white/10 rounded-md py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-white/5 overflow-hidden">
            <div className="grid grid-cols-[1fr_80px] gap-4">
              {filtered.map((memory, i) => (
                <div key={memory.id} className={`p-4 flex items-center justify-between group transition-colors hover:bg-white/5 ${i !== filtered.length - 1 ? 'border-b border-white/5' : ''}`}>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getTypeColor(memory.type)}`}>
                        {memory.type}
                      </span>
                      {memory.visibility === 'private' ? (
                        <div className="flex items-center text-xs text-muted-foreground gap-1"><Lock className="h-3 w-3" /> Private</div>
                      ) : (
                        <div className="flex items-center text-xs text-muted-foreground gap-1"><Globe className="h-3 w-3" /> Shared</div>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">Conf: {memory.confidence}</span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed">{memory.value}</p>
                    <div className="flex items-center gap-2 pt-1">
                      {memory.tags.map(tag => (
                        <span key={tag} className="text-xs text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="p-8 text-center text-muted-foreground col-span-2">
                  No memory units found matching "{search}".
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}