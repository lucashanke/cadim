import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { INVESTMENT_TYPE_LABELS, MANUAL_TYPE_SUBTYPES, SUBTYPE_LABELS } from '@/constants/investments'

interface AddManualPositionModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: { investment_type: string; subtype: string; amount: number; due_date: string | null }) => void
}

export function AddManualPositionModal({ open, onClose, onSave }: AddManualPositionModalProps) {
  const defaultType = Object.keys(MANUAL_TYPE_SUBTYPES)[0]
  const [type, setType] = useState(defaultType)
  const [subtype, setSubtype] = useState(MANUAL_TYPE_SUBTYPES[defaultType][0])
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')

  if (!open) return null

  const handleTypeChange = (newType: string) => {
    setType(newType)
    setSubtype(MANUAL_TYPE_SUBTYPES[newType][0])
  }

  const handleSubmit = () => {
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return
    onSave({ investment_type: type, subtype, amount: parsed, due_date: dueDate || null })
    setType(defaultType); setSubtype(MANUAL_TYPE_SUBTYPES[defaultType][0]); setAmount(''); setDueDate('')
  }

  const subtypes = MANUAL_TYPE_SUBTYPES[type] ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <Card className="relative z-10 w-[420px] mx-4" onClick={e => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>Add Position</CardTitle>
          <CardDescription>Manually add an investment position</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select value={type} onChange={e => handleTypeChange(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {Object.keys(MANUAL_TYPE_SUBTYPES).map(t => (
                <option key={t} value={t}>{INVESTMENT_TYPE_LABELS[t]?.label ?? t}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Subtype</Label>
            <select value={subtype} onChange={e => setSubtype(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md text-sm px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              {subtypes.map(s => (
                <option key={s} value={s}>{SUBTYPE_LABELS[s]?.label ?? s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (BRL)</Label>
            <Input type="number" min="0" step="0.01" placeholder="0.00"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Due Date <span className="text-muted-foreground">(optional)</span></Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </CardContent>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!amount || parseFloat(amount) <= 0}>Save</Button>
        </div>
      </Card>
    </div>
  )
}
