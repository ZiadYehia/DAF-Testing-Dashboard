import { useEffect, useRef, useState } from 'react'
import type { AutomationEngine } from '@automation-hub/types'

export interface ChatTool { tool: string; ok: boolean }
export interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
  tools: ChatTool[]
}

interface UseChatSessionParams {
  base: string
  chatModel: string
  lockedEngine: AutomationEngine | null
  /** Called once a chat session has been generated & saved as a replayable automation. */
  onSaved: (name: string, pyWarning?: string) => void | Promise<void>
}

/**
 * MCP chat authoring session — drives a real browser/Android app via tool calls
 * and can be saved as a replayable automation. Instantiated once in the hub
 * (not inside the chat tab's panel) so the live session — and its transcript —
 * survives switching away from the chat tab, since base-ui's Tabs unmount
 * inactive panels.
 */
export function useChatSession({ base, chatModel, lockedEngine, onSaved }: UseChatSessionParams) {
  const [chat, setChat] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatBusy, setChatBusy] = useState(false)
  const [chatSession, setChatSession] = useState<string | null>(null)
  const [chatEngine, setChatEngine] = useState<'playwright' | 'appium'>('playwright')
  const [chatApkPath, setChatApkPath] = useState('')
  const [chatAvd, setChatAvd] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveTitle, setSaveTitle] = useState('')
  const [savingChat, setSavingChat] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [pendingLink, setPendingLink] = useState<{ feature: string; testcaseId: string } | null>(null)
  const canSave = !!chatSession && !chatBusy && chat.some((m) => m.role === 'assistant' && m.tools.length > 0)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  // Force chat authoring onto the app's locked engine (registry loads async).
  //
  // Only the two BROWSER/DEVICE engines are chat-authorable — there is no api authoring
  // client, and `chatEngine` is deliberately kept to that narrower pair so the request body
  // built in sendChat cannot claim an engine the MCP layer has no session type for. An API
  // app never reaches here anyway: AutomationHub hides the chat tab for it.
  useEffect(() => {
    if (lockedEngine === 'playwright' || lockedEngine === 'appium') setChatEngine(lockedEngine)
  }, [lockedEngine])

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight })
  }, [chat])

  // Close the browser session when leaving the page.
  useEffect(() => {
    return () => {
      if (chatSession) {
        navigator.sendBeacon?.(`${base}/chat?sessionId=${chatSession}`)
        fetch(`${base}/chat?sessionId=${chatSession}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }, [chatSession, base])

  async function sendChat() {
    const message = chatInput.trim()
    const startingAppiumChat = !chatSession && chatEngine === 'appium'
    if (!message || chatBusy || !chatModel || (startingAppiumChat && !chatApkPath.trim())) return
    setChatInput('')
    setChatBusy(true)
    setChat((c) => [...c, { role: 'user', text: message, tools: [] }, { role: 'assistant', text: '', tools: [] }])

    // Mutate the last (assistant) message as events stream in.
    const patchAssistant = (fn: (m: ChatMsg) => void) =>
      setChat((c) => {
        const next = [...c]
        const last = { ...next[next.length - 1] }
        fn(last)
        next[next.length - 1] = last
        return next
      })

    try {
      const res = await fetch(`${base}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          model: chatModel,
          sessionId: chatSession,
          ...(startingAppiumChat
            ? { engine: 'appium', appium: { apkPath: chatApkPath, ...(chatAvd.trim() ? { avd: chatAvd.trim() } : {}) } }
            : {}),
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        patchAssistant((m) => { m.text = `⚠️ ${err?.error ?? 'Request failed'}` })
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const frames = buf.split('\n\n')
        buf = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.replace(/^data: /, '').trim()
          if (!line) continue
          let e: any
          try { e = JSON.parse(line) } catch { continue }
          if (e.type === 'session') setChatSession(e.sessionId)
          else if (e.type === 'text') patchAssistant((m) => { m.text += (m.text ? '\n\n' : '') + e.text })
          else if (e.type === 'tool_use') patchAssistant((m) => { m.tools.push({ tool: e.tool, ok: true }) })
          else if (e.type === 'tool_result') patchAssistant((m) => {
            // reflect the latest matching tool's outcome
            for (let i = m.tools.length - 1; i >= 0; i--) {
              if (m.tools[i].tool === e.tool) { m.tools[i] = { tool: e.tool, ok: e.ok }; break }
            }
          })
          else if (e.type === 'error') patchAssistant((m) => { m.text += `\n\n⚠️ ${e.message}` })
        }
      }
    } catch (err: any) {
      patchAssistant((m) => { m.text += `\n\n⚠️ ${err?.message ?? 'Connection lost'}` })
    } finally {
      setChatBusy(false)
    }
  }

  async function saveAsAutomation() {
    if (!chatSession || !saveTitle.trim()) return
    setSavingChat(true)
    setSaveErr(null)
    try {
      const res = await fetch(`${base}/chat/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: chatSession, title: saveTitle, linkedTestcase: pendingLink }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveErr(data?.error ?? 'Failed to save'); return }
      setSaveOpen(false)
      setSaveTitle('')
      setPendingLink(null)
      await onSaved(data.name, data.pyWarning)
    } finally {
      setSavingChat(false)
    }
  }

  async function resetChat() {
    if (chatSession) {
      fetch(`${base}/chat?sessionId=${chatSession}`, { method: 'DELETE' }).catch(() => {})
    }
    setChatSession(null)
    setChat([])
  }

  /** Clear any live session and seed the composer from a dashboard test case. */
  function beginFromTestcase(tc: { feature: string; id: string; objective: string; steps: string }) {
    if (chatSession) fetch(`${base}/chat?sessionId=${chatSession}`, { method: 'DELETE' }).catch(() => {})
    setChatSession(null)
    setChat([])
    setPendingLink({ feature: tc.feature, testcaseId: tc.id })
    setSaveTitle(`${tc.id} — ${tc.objective}`.slice(0, 80))
    setChatInput(
      `Automate this test case end-to-end in the browser, then tell me exactly what you verified.\n\n` +
      `Test case ${tc.id} (feature: ${tc.feature})\nObjective: ${tc.objective}\n\nSteps:\n${tc.steps}`,
    )
  }

  return {
    chat,
    chatInput, setChatInput,
    chatBusy,
    chatSession,
    chatEngine, setChatEngine,
    chatApkPath, setChatApkPath,
    chatAvd, setChatAvd,
    saveOpen, setSaveOpen,
    saveTitle, setSaveTitle,
    savingChat,
    saveErr,
    pendingLink,
    canSave,
    chatScrollRef,
    sendChat,
    saveAsAutomation,
    resetChat,
    beginFromTestcase,
  }
}

export type ChatSession = ReturnType<typeof useChatSession>
