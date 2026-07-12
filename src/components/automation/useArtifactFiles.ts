import { useCallback, useState } from 'react'

export interface ArtifactFile {
  path: string
  content: string
}

/** Sentinel selecting the test file (vs. a page file path) in the chip row. */
export const TEST_SENTINEL = '__test__'

export interface ApplyServerResultInput {
  /** New test content — e.g. `improve`'s `spec`/`pySpec`. Omit to leave the test file untouched. */
  test?: string
  /** New/updated page files — e.g. `improve`'s `tsPageFiles`/`pageFiles`. Omit to leave page files untouched. */
  files?: ArtifactFile[]
  /** Paths just written by the AI — drives the amber "recently touched" dot. */
  touchedPages?: string[]
}

export interface UseArtifactFilesResult {
  /** Editable draft of the test file. */
  testDraft: string
  setTestDraft: (v: string) => void
  /** Last known server value of the test file — dirty-checked against `testDraft`. */
  serverTest: string
  /** Last known server value of each page file (path + content). */
  files: ArtifactFile[]
  /** Editable draft per page file path. */
  pageDrafts: Record<string, string>
  setPageDraft: (path: string, content: string) => void
  /** `TEST_SENTINEL` or a page file path — whichever chip is active. */
  active: string
  /** Select a chip; clears the "recently touched" dot on the chip being left. */
  select: (path: string) => void
  recentlyTouched: Set<string>
  /** Apply a partial server result (from improve/translate) without discarding unrelated drafts. */
  applyServerResult: (result: ApplyServerResultInput) => void
  /** Reset all state from a freshly loaded project detail — call from `loadDetail`. */
  resetFrom: (test: string, files: ArtifactFile[]) => void
  /** Whether the currently active chip has unsaved edits. */
  activeDirty: boolean
  activeIsTest: boolean
  /** Draft content of whichever chip is active (test or page file). */
  activeContent: string
  setActiveContent: (v: string) => void
}

/**
 * Shared chip/draft/dirty machinery for a test file + its shared page files —
 * used for both the TS artifact (spec + tsPageFiles) and the Python artifact
 * (pySpec + pageFiles). Instantiate once per language so drafts survive tab
 * switches; call `resetFrom` whenever the project detail is (re)loaded from
 * the server, and `applyServerResult` after an AI call that returns updated
 * content inline (before the detail reload catches up).
 */
export function useArtifactFiles({
  testContent,
  files: initialFiles,
}: {
  testContent: string
  files: ArtifactFile[]
}): UseArtifactFilesResult {
  const [testDraft, setTestDraft] = useState(testContent)
  const [serverTest, setServerTest] = useState(testContent)
  const [files, setFiles] = useState<ArtifactFile[]>(initialFiles)
  const [pageDrafts, setPageDrafts] = useState<Record<string, string>>(
    Object.fromEntries(initialFiles.map((f) => [f.path, f.content])),
  )
  const [active, setActive] = useState<string>(TEST_SENTINEL)
  const [recentlyTouched, setRecentlyTouched] = useState<Set<string>>(new Set())

  const setPageDraft = useCallback((path: string, content: string) => {
    setPageDrafts((d) => ({ ...d, [path]: content }))
  }, [])

  // Switching chips acknowledges the "recently touched by AI" highlight on the file being left.
  const select = useCallback((path: string) => {
    setRecentlyTouched((prev) => {
      if (!prev.has(active)) return prev
      const next = new Set(prev)
      next.delete(active)
      return next
    })
    setActive(path)
  }, [active])

  const resetFrom = useCallback((test: string, nextFiles: ArtifactFile[]) => {
    setTestDraft(test)
    setServerTest(test)
    setFiles(nextFiles)
    setPageDrafts(Object.fromEntries(nextFiles.map((f) => [f.path, f.content])))
    // Keep the active chip if it still exists (e.g. after saving a page file); otherwise fall back to the test file.
    setActive((prev) => (prev === TEST_SENTINEL || nextFiles.some((f) => f.path === prev)) ? prev : TEST_SENTINEL)
    setRecentlyTouched(new Set())
  }, [])

  const applyServerResult = useCallback(({ test, files: nextFiles, touchedPages }: ApplyServerResultInput) => {
    if (test !== undefined) {
      setTestDraft(test)
      setServerTest(test)
    }
    if (nextFiles) {
      setFiles(nextFiles)
      setPageDrafts(Object.fromEntries(nextFiles.map((f) => [f.path, f.content])))
    }
    if (touchedPages) setRecentlyTouched(new Set(touchedPages))
  }, [])

  const activeIsTest = active === TEST_SENTINEL
  const activeDirty = activeIsTest
    ? testDraft !== serverTest
    : pageDrafts[active] !== (files.find((f) => f.path === active)?.content ?? '')

  const activeContent = activeIsTest ? testDraft : (pageDrafts[active] ?? '')
  const setActiveContent = useCallback((v: string) => {
    if (active === TEST_SENTINEL) setTestDraft(v)
    else setPageDraft(active, v)
  }, [active, setPageDraft])

  return {
    testDraft,
    setTestDraft,
    serverTest,
    files,
    pageDrafts,
    setPageDraft,
    active,
    select,
    recentlyTouched,
    applyServerResult,
    resetFrom,
    activeDirty,
    activeIsTest,
    activeContent,
    setActiveContent,
  }
}
