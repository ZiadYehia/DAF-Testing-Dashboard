'use client'

import * as React from 'react'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ConfirmDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmWord?: string
  confirmLabel?: string
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

// Generic type-to-confirm delete dialog. Requires the user to type an exact,
// case-sensitive match of confirmWord before the destructive action unlocks —
// used anywhere a delete is hard to undo and deserves more friction than a
// plain "are you sure" confirm.
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord = 'Delete',
  confirmLabel = 'Delete',
  loading = false,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  const [input, setInput] = useState('')

  useEffect(() => {
    setInput('')
  }, [open])

  const canConfirm = input === confirmWord && !loading

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && loading) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-1.5 py-1">
          <label className="text-sm font-medium">
            Type &quot;{confirmWord}&quot; to confirm
          </label>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canConfirm) onConfirm()
            }}
            placeholder={confirmWord}
            autoFocus
            disabled={loading}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={!canConfirm} className="gap-1.5">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
