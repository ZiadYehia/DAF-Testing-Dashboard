'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Bot, Wand2, Download } from 'lucide-react'
import { ArtifactEditor } from './ArtifactEditor'
import type { UseArtifactFilesResult } from './useArtifactFiles'

export interface PageFile { path: string; content: string }

interface SpecTabProps {
  language: 'ts' | 'py'
  selected: string
  artifact: UseArtifactFilesResult
  primaryPaths: string[]
  saving: boolean
  onSave: () => void
  aiEnabled: boolean
  aiInstruction: string
  setAiInstruction: (v: string) => void
  improving: boolean
  onImprove: () => void
  lockedFiles?: PageFile[]
  pythonEnabled?: boolean
  translating?: boolean
  onTranslate?: (confirmOverwrite: boolean) => void
  onDownload?: () => void
}

/**
 * One TS/Python spec-tab body. The two languages share the same chip/editor/
 * ask-AI machinery (ArtifactEditor); they differ only in the "no spec yet"
 * empty state (Python needs an explicit Generate step) and a couple of extra
 * toolbar actions (Download / Regenerate) that only apply to the derived
 * Python artifact.
 */
export function SpecTab({
  language, selected, artifact, primaryPaths, saving, onSave,
  aiEnabled, aiInstruction, setAiInstruction, improving, onImprove,
  lockedFiles, pythonEnabled, translating, onTranslate, onDownload,
}: SpecTabProps) {
  if (language === 'ts') {
    return (
      <ArtifactEditor
        language="typescript"
        testLabel="test.spec.ts"
        files={artifact.files}
        primaryPaths={primaryPaths}
        lockedFiles={lockedFiles ?? []}
        active={artifact.active}
        onSelect={artifact.select}
        recentlyTouched={artifact.recentlyTouched}
        activeContent={artifact.activeContent}
        onActiveContentChange={artifact.setActiveContent}
        activeIsTest={artifact.activeIsTest}
        activeDirty={artifact.activeDirty}
        saving={saving}
        onSave={onSave}
        aiRow={aiEnabled && (
          <div className="flex items-center gap-2 border-t pt-2">
            <Input
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && aiInstruction.trim()) onImprove() }}
              placeholder="Ask AI to change the spec — e.g. “wait for the table to load before asserting”"
              disabled={improving}
              className="h-8 flex-1 text-xs"
            />
            <Button size="sm" variant="outline" onClick={onImprove} disabled={!aiInstruction.trim() || improving} className="gap-1.5">
              {improving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              Ask AI
            </Button>
          </div>
        )}
      />
    )
  }

  // Python spec — generated from the TS spec; can't be replayed by the hub.
  if (!artifact.testDraft.trim()) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
          <Wand2 className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">No Python spec yet</p>
          <p className="mx-auto max-w-xs text-xs text-muted-foreground">
            Generate a Python equivalent of the TypeScript spec above for use outside the hub.
          </p>
        </div>
        {pythonEnabled === false ? (
          <p className="text-xs text-muted-foreground">
            Python generation isn’t configured for this app.
          </p>
        ) : (
          <Button size="sm" onClick={() => onTranslate?.(false)} disabled={translating} className="gap-1.5">
            {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {translating ? 'Generating…' : 'Generate Python from TypeScript'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <ArtifactEditor
        language="python"
        testLabel={`test_${selected}.py`}
        files={artifact.files}
        primaryPaths={primaryPaths}
        active={artifact.active}
        onSelect={artifact.select}
        recentlyTouched={artifact.recentlyTouched}
        activeContent={artifact.activeContent}
        onActiveContentChange={artifact.setActiveContent}
        activeIsTest={artifact.activeIsTest}
        activeDirty={artifact.activeDirty}
        saving={saving}
        onSave={onSave}
        extraToolbar={
          <>
            <Button size="sm" variant="outline" onClick={onDownload} className="h-7 gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            <Button size="sm" variant="outline" onClick={() => onTranslate?.(true)} disabled={translating} className="h-7 gap-1.5 text-xs">
              {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Regenerate from TS
            </Button>
          </>
        }
        aiRow={aiEnabled && (
          <div className="flex items-center gap-2 border-t pt-2">
            <Input
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && aiInstruction.trim()) onImprove() }}
              placeholder="Ask AI to change the Python spec…"
              disabled={improving}
              className="h-8 flex-1 text-xs"
            />
            <Button size="sm" variant="outline" onClick={onImprove} disabled={!aiInstruction.trim() || improving} className="gap-1.5">
              {improving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              Ask AI
            </Button>
          </div>
        )}
      />
      <p className="text-[11px] text-muted-foreground">
        The hub replays the TypeScript spec only — run this file with pytest outside the dashboard.
      </p>
    </>
  )
}
