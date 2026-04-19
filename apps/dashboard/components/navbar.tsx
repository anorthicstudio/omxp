"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Shield, BrainCircuit, LayoutDashboard, Key, Database } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "./ui/badge"

const navItems = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Memories", href: "/memory", icon: BrainCircuit },
  { name: "Permissions", href: "/permissions", icon: Shield },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 glass">
      <div className="container flex h-16 items-center px-4 mx-auto">
        <div className="flex items-center gap-2 mr-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 border border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight hidden sm:inline-block text-gradient">
            OMXP Vault
          </span>
          <Badge variant="glass" className="ml-2 font-mono text-[10px] hidden sm:flex">v0.1</Badge>
        </div>
        <nav className="flex flex-1 items-center space-x-1 sm:space-x-2 text-sm font-medium">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-300 relative",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive && "text-primary")} />
                <span className="hidden sm:inline-block">{item.name}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 h-0.5 w-full bg-primary shadow-[0_-2px_10px_rgba(59,130,246,0.5)] rounded-t-full" />
                )}
              </Link>
            )
          })}
        </nav>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)] animate-pulse" />
            <span className="hidden sm:inline-block font-mono">localhost:4747</span>
          </div>
        </div>
      </div>
    </header>
  )
}
