import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { INVESTMENT_TYPE_LABELS } from '@/constants/investments'
import type { ManualPosition } from '@/types'

interface EditManualPositionModalProps {
  position: ManualPosition | null
  onClose: () => void
  onSave: (id: string, amount: number) => void
}

export function EditManualPositionModal({ position, onClose, onSave }: EditManualPositionModalProps) {
  const [amount, setAmount] = useState('')

  useEffect(() => { setAmount(position ? String(position.amount) : '') }, [position])

  if (!position) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <Card className="relative z-10 w-[380px] mx-4" onClick={e => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>Edit Position</CardTitle>
          <CardDescription>
            {INVESTMENT_TYPE_LABELS[position.investment_type]?.label ?? position.investment_type}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Amount (BRL)</Label>
            <Input type="number" min="0" step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </CardContent>
        <div className="flex justify-end gap-2 px-6 pb-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(position.id, parseFloat(amount))}
            disabled={!amount || parseFloat(amount) <= 0}>Update</Button>
        </div>
      </Card>
    </div>
  )
}
