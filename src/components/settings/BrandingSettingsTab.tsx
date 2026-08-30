'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Save, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { fetchWithRetry } from '@/components/settings/fetchWithRetry'

export function BrandingSettingsTab() {
  // Branding
  const [dashboardLogo, setDashboardLogo] = useState<string | null>(null)
  const [pendingLogo, setPendingLogo] = useState<string | null>(null)
  const [savingLogo, setSavingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const loadLogos = useCallback(async () => {
    try {
      const res = await fetchWithRetry('/api/logo')
      if (res.ok) {
        const data: Record<string, string> = await res.json()
        const logo = data['dashboard'] ?? null
        setDashboardLogo(logo)
        setPendingLogo(logo)
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadLogos()
  }, [loadLogos])

  async function handleLogoFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB')
      return
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    setPendingLogo(dataUrl)
  }

  async function saveLogo() {
    setSavingLogo(true)
    try {
      const res = await fetch('/api/logo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dashboard', value: pendingLogo ?? '' }),
      })
      if (res.ok) {
        setDashboardLogo(pendingLogo)
        toast.success('Logo saved — reload the page to see it in the sidebar')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? 'Failed to save logo')
      }
    } finally {
      setSavingLogo(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dashboard Logo</CardTitle>
        <CardDescription>
          Shown in the sidebar next to &ldquo;zTestGround&rdquo;. Square PNG or SVG recommended, max 2 MB.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
            {pendingLogo
              ? <img src={pendingLogo} alt="Logo preview" className="h-full w-full object-contain p-1" />
              : <span className="text-2xl select-none">🧪</span>
            }
          </div>
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              {pendingLogo ? 'Preview of uploaded logo' : 'No logo uploaded — default icon is used'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => logoInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                {pendingLogo ? 'Replace' : 'Upload'}
              </Button>
              {pendingLogo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => setPendingLogo(null)}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoFileSelect}
        />

        <div className="pt-1">
          <Button
            onClick={saveLogo}
            disabled={savingLogo || pendingLogo === dashboardLogo}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {savingLogo ? 'Saving…' : 'Save Logo'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
