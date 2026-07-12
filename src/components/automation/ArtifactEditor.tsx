'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Save, Lock, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SpecEditor } from './SpecEditor'
import { TEST_SENTINEL, type ArtifactFile } from './useArtifactFiles'

interface ArtifactEditorProps {
  language: 'typescript' | 'python'
  /** Display name for the test chip's active filename, e.g. "test.spec.ts" or `test_${name}.py`. */
  testLabel: string
  /** Editable shared page files (chip per file). */
  files: ArtifactFile[]
  /** Read-only framework files rendered with a lock icon — never editable, no Save button. */
  lockedFiles?: ArtifactFile[]
  active: string
  onSelect: (path: string) => void
  recentlyTouched: Set<string>
  activeContent: string
  onActiveContentChange: (v: string) => void
  activeIsTest: boolean
  activeDirty: boolean
  saving: boolean
  onSave: () => void
  /** Extra toolbar controls (e.g. Download / Regenerate) rendered before the Save button. */
  extraToolbar?: ReactNode
  /** Ask-AI row rendered beneath the editor. */
  aiRow?: ReactNode
  height?: string
  /**
   * Paths of the page file(s) the test actually references (its imports/fixture).
   * When set and non-empty, other page chips collapse behind a "+N more pages"
   * expander — the one-page-per-test rule makes them secondary. Active or
   * recently-AI-touched chips always stay visible.
   */
  primaryPaths?: string[]
}

/**
 * Presentational chip-row + toolbar + code editor for a test file and its
 * shared page files — shared by the TypeScript and Python spec tabs. Callers
 * own all state (via `useArtifactFiles`) and pass it in as props.
 */
export function ArtifactEditor({
  language,
  testLabel,
  files,
  lockedFiles = [],
  active,
  onSelect,
  recentlyTouched,
  activeContent,
  onActiveContentChange,
  activeIsTest,
  activeDirty,
  saving,
  onSave,
  extraToolbar,
  aiRow,
  height = '260px',
  primaryPaths,
}: ArtifactEditorProps) {
  const [pagesExpanded, setPagesExpanded] = useState(false)
  const activeLockedFile = lockedFiles.find((f) => f.path === active)
  const isLocked = !!activeLockedFile
  const activeFileName = activeIsTest
    ? testLabel
    : (active.split('/').pop() ?? active)

  // One-page-per-test focus: with a known primary page, secondary chips collapse
  // behind an expander. No primary detected (blank starter, unparsable test) → show all.
  const collapsible = !!primaryPaths?.length
  const isAlwaysVisible = (f: ArtifactFile) =>
    !collapsible || primaryPaths!.includes(f.path) || f.path === active || recentlyTouched.has(f.path)
  const visibleFiles = pagesExpanded ? files : files.filter(isAlwaysVisible)
  const hiddenCount = files.length - visibleFiles.length

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => onSelect(TEST_SENTINEL)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
            active === TEST_SENTINEL
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          Test
        </button>
        {visibleFiles.map((f) => {
          const filename = f.path.split('/').pop() ?? f.path
          const touched = recentlyTouched.has(f.path)
          return (
            <button
              key={f.path}
              onClick={() => onSelect(f.path)}
              title={f.path}
              className={cn(
                'relative rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                active === f.path
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              {filename}
              {touched && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500"
                  title="Recently updated by AI"
                />
              )}
            </button>
          )
        })}
        {collapsible && (hiddenCount > 0 || pagesExpanded) && (
          <button
            onClick={() => setPagesExpanded((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            title={pagesExpanded ? 'Hide pages this test does not use' : 'Show every page object for this app'}
          >
            {pagesExpanded
              ? <><ChevronUp className="h-3 w-3" /> Fewer pages</>
              : <><ChevronDown className="h-3 w-3" /> +{hiddenCount} more page{hiddenCount === 1 ? '' : 's'}</>}
          </button>
        )}
        {lockedFiles.map((f) => (
          <button
            key={f.path}
            onClick={() => onSelect(f.path)}
            title={f.path}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              active === f.path
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <Lock className="h-2.5 w-2.5" />
            {f.path.split('/').pop() ?? f.path}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {isLocked && <Lock className="h-3 w-3" />}
          {activeFileName}
        </p>
        <div className="flex items-center gap-1.5">
          {extraToolbar}
          {!isLocked && (
            <Button size="sm" variant="outline" onClick={onSave} disabled={!activeDirty || saving} className="h-7 gap-1.5 text-xs">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {activeDirty ? 'Save' : 'Saved'}
            </Button>
          )}
        </div>
      </div>

      <SpecEditor
        value={isLocked ? (activeLockedFile?.content ?? '') : activeContent}
        onChange={isLocked ? undefined : onActiveContentChange}
        language={language}
        readOnly={isLocked}
        height={height}
      />

      {!isLocked && aiRow}
    </div>
  )
}
