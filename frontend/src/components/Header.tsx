import { Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'

export function Header() {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-card px-6 shrink-0">
      <div className="flex-1">
        <div className="relative w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search assets, items, transactions..."
            className="pl-8 h-8 text-sm bg-secondary border-border focus:border-primary/50 transition-all"
          />
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold uppercase tracking-widest text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        Live
      </div>
      <Avatar className="h-8 w-8 border border-border">
        <AvatarImage src="/avatars/01.png" alt="@user" />
        <AvatarFallback>LH</AvatarFallback>
      </Avatar>
    </header>
  )
}
