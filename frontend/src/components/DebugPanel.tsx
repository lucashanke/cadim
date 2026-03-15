import { useState } from 'react'
import { Bug, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

interface DebugSection {
  label: string
  data: unknown
}

interface DebugPanelProps {
  sections: DebugSection[]
}

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const json = JSON.stringify(data, null, 2)
  const lineCount = json.split('\n').length
  const preview = Array.isArray(data)
    ? `Array(${data.length})`
    : data && typeof data === 'object'
      ? `{${Object.keys(data).length} keys}`
      : String(data)

  function handleCopy() {
    navigator.clipboard.writeText(json)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border border-border/60 rounded-md overflow-hidden">
      <button
        className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {label}
          <span className="font-normal text-muted-foreground">{preview}</span>
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{lineCount} lines</span>
      </button>
      {expanded && (
        <div className="relative">
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy JSON"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <pre className="px-3 py-2 text-[11px] leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto bg-muted/20 text-foreground/80 font-mono">
            {json}
          </pre>
        </div>
      )}
    </div>
  )
}

export function DebugPanel({ sections }: DebugPanelProps) {
  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Sheet>
        <SheetTrigger render={
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full border-amber-500/40 bg-background shadow-lg hover:bg-amber-500/10"
          />
        }>
          <Bug className="h-4 w-4 text-amber-500" />
        </SheetTrigger>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-amber-500" />
              Debug Panel
            </SheetTitle>
            <SheetDescription>
              Raw data used on this page ({sections.length} sections)
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4 space-y-2">
            {sections.map((section) => (
              <JsonBlock key={section.label} label={section.label} data={section.data} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
