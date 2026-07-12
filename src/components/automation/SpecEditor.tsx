'use client'

import { useEffect, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import { EditorView } from '@codemirror/view'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface SpecEditorProps {
  value: string
  onChange?: (v: string) => void
  language: 'typescript' | 'python'
  readOnly?: boolean
  height?: string
  placeholder?: string
  className?: string
}

/**
 * Reusable CodeMirror wrapper used for both the TypeScript Playwright spec and
 * the generated Python spec. Wraps in the same rounded/bordered chrome as the
 * app's Textarea so it sits naturally alongside other inputs.
 */
export function SpecEditor({
  value,
  onChange,
  language,
  readOnly = false,
  height = '460px',
  placeholder,
  className,
}: SpecEditorProps) {
  // Avoid SSR/hydration mismatch: resolvedTheme is undefined until mounted.
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme } = useTheme()
  useEffect(() => setMounted(true), [])

  const theme = mounted && resolvedTheme === 'dark' ? vscodeDark : vscodeLight
  const extensions = [
    language === 'python' ? python() : javascript({ typescript: true }),
    EditorView.theme({ '&': { fontSize: '13px' } }),
  ]

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-input transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        editable={!readOnly}
        readOnly={readOnly}
        height={height}
        theme={theme}
        placeholder={placeholder}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: !readOnly,
          highlightActiveLineGutter: !readOnly,
          bracketMatching: true,
          foldGutter: true,
        }}
        style={{ fontFamily: 'var(--font-mono, monospace)' }}
      />
    </div>
  )
}
