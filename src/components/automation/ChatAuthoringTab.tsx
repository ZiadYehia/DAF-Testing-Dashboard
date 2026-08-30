'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Bot, MessageSquare, Send, Wrench, Square, Save, Plus, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatSession } from './useChatSession'

interface ChatAuthoringTabProps {
  session: ChatSession
  aiEnabled: boolean
  lockedEngine: 'playwright' | 'appium' | null
  chatModel: string
  modelName: string
}

/**
 * MCP chat authoring tab — drives a real browser/Android app via tool calls and
 * lets the result be saved as a replayable automation. All session state (the
 * transcript, the live session id, …) lives in the `useChatSession` hook passed
 * in as `session`, instantiated once in the hub so it survives tab switches.
 */
export function ChatAuthoringTab({ session, aiEnabled, lockedEngine, chatModel, modelName }: ChatAuthoringTabProps) {
  const {
    chat, chatInput, setChatInput, chatBusy, chatSession,
    chatEngine, setChatEngine, chatApkPath, setChatApkPath, chatAvd, setChatAvd,
    saveOpen, setSaveOpen, saveTitle, setSaveTitle, savingChat, saveErr, pendingLink,
    canSave, chatScrollRef, sendChat, saveAsAutomation, resetChat,
  } = session

  if (!aiEnabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex h-64 flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Bot className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">AI is turned off for this app</p>
            <p className="mx-auto max-w-sm text-sm text-muted-foreground">
              Enable the Automation Hub under <span className="font-medium">Settings → AI &amp; Models</span> to use chat authoring, generate-from-test-case, and AI spec edits.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex h-[70vh] flex-col">
      {/* Toolbar: live status + engine toggle + save / new chat */}
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn('h-1.5 w-1.5 rounded-full', chatSession ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
          {chatSession
            ? (chatEngine === 'appium' ? 'Live Android session' : 'Live browser session')
            : (chatEngine === 'appium' ? 'Drives a real Android app' : 'Drives a real browser')}
          <span className="hidden sm:inline">·</span>
          <span className="hidden font-medium text-foreground sm:inline">{modelName}</span>
        </span>
        <div className="flex items-center gap-2">
          {!lockedEngine && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setChatEngine('playwright')}
                disabled={!!chatSession}
                className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  chatSession ? 'opacity-50' : '',
                  chatEngine === 'playwright' ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground')}
              >
                Web
              </button>
              <button
                type="button"
                onClick={() => setChatEngine('appium')}
                disabled={!!chatSession}
                className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                  chatSession ? 'opacity-50' : '',
                  chatEngine === 'appium' ? 'border-primary bg-primary text-primary-foreground' : 'border-border/60 text-muted-foreground hover:border-primary/50 hover:text-foreground')}
              >
                Android
              </button>
            </div>
          )}
          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogTrigger render={
              <Button variant="outline" size="sm" disabled={!canSave} className="gap-1.5" title={canSave ? 'Save this session as a replayable automation' : 'Drive a flow first'}>
                <Save className="h-3.5 w-3.5" /> Save as automation
              </Button>
            } />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save as automation</DialogTitle>
                <DialogDescription>
                  {chatEngine === 'appium'
                    ? 'Generates an Appium spec from this session’s actions and adds it to your automations, ready to replay.'
                    : 'Generates a Playwright spec from this session’s actions and adds it to your automations, ready to replay.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Input
                  placeholder="e.g. Example domain heading check"
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && saveTitle.trim()) saveAsAutomation() }}
                  autoFocus
                />
                {pendingLink && (
                  <p className="text-xs text-muted-foreground">
                    Links to <span className="font-mono">{pendingLink.testcaseId}</span> — replays will sync its status.
                  </p>
                )}
                {saveErr && <p className="text-xs text-red-600 dark:text-red-400">{saveErr}</p>}
              </div>
              <DialogFooter>
                <Button onClick={saveAsAutomation} disabled={!saveTitle.trim() || savingChat} className="gap-2">
                  {savingChat && <Loader2 className="h-4 w-4 animate-spin" />} Generate &amp; save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={resetChat} disabled={chatBusy || chat.length === 0} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> New chat
          </Button>
        </div>
      </div>

      {/* Appium target: editable before a session starts, read-only once bound */}
      {chatEngine === 'appium' && (
        chatSession ? (
          <div className="flex items-center gap-1.5 border-b px-3 py-2">
            <Badge variant="outline" className="gap-1 font-mono text-[10px]">
              Android · {chatApkPath.split(/[\\/]/).pop() ?? 'no APK'}
            </Badge>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
            <Input
              placeholder="Path to the APK, e.g. C:\builds\app-debug.apk"
              value={chatApkPath}
              onChange={(e) => setChatApkPath(e.target.value)}
              className="h-8 flex-1 text-xs"
            />
            <Input
              placeholder="AVD name override (optional — defaults to ANDROID_AVD)"
              value={chatAvd}
              onChange={(e) => setChatAvd(e.target.value)}
              className="h-8 flex-1 text-xs"
            />
          </div>
        )
      )}

      {/* Transcript */}
      <div ref={chatScrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {chat.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <MessageSquare className="h-8 w-8 text-primary/50" />
            <p className="max-w-md">
              {chatEngine === 'appium' ? (
                <>
                  Describe a flow and Claude will drive a real Android app via Appium MCP —
                  e.g. <em>“Open the app, log in, and confirm the home screen shows my dashboard.”</em>
                </>
              ) : (
                <>
                  Describe a flow and Claude will drive a real browser via Playwright MCP —
                  e.g. <em>“Go to example.com and confirm the heading says Example Domain.”</em>
                </>
              )}
            </p>
          </div>
        )}
        {chat.map((m, i) => (
          <div key={i} className={cn('flex items-start gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            {m.role === 'assistant' && (
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm',
              m.role === 'user' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted',
            )}>
              {m.tools.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {m.tools.map((t, j) => (
                    <span key={j} className="inline-flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-[10px] font-mono">
                      {t.ok ? <Wrench className="h-2.5 w-2.5" /> : <XCircle className="h-2.5 w-2.5 text-red-500" />}
                      {t.tool}
                    </span>
                  ))}
                </div>
              )}
              {m.text
                ? <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                : <span className="inline-flex items-center gap-1.5 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> working…</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
          placeholder={chatModel ? 'Describe the flow to automate…' : 'No AI model available — add a provider API key in Settings → AI & Models.'}
          disabled={chatBusy || !chatModel}
          className="min-h-[44px] max-h-32 flex-1 resize-none text-sm"
        />
        <Button
          onClick={sendChat}
          disabled={chatBusy || !chatInput.trim() || !chatModel || (!chatSession && chatEngine === 'appium' && !chatApkPath.trim())}
          className="gap-1.5"
        >
          {chatBusy ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </Card>
  )
}
