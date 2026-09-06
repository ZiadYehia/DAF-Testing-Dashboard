'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check, ChevronDown, Globe, Plus, Server, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEnvironmentManager } from '@/components/environments/useEnvironmentManager'
import { EnvironmentList } from '@/components/environments/EnvironmentList'
import { EnvironmentFormDialog } from '@/components/environments/EnvironmentFormDialog'

/**
 * Pick which server the automation runs against, and see exactly what that means.
 *
 * Applies to every app type. A web app switches its base URL and dashboard logins, an API app
 * its service URLs and keys, a mobile app the backend its build talks to — same shape, so this
 * is not special-cased per engine.
 *
 * The variables are shown in full. Someone about to point a suite at a different server needs
 * to see which host and which credentials they are switching to, and a masked value makes that
 * comparison impossible. These are the team's own test credentials and none of this is written
 * to the committed `data/` tree.
 *
 * The active environment's variables are injected into the run child by the run route and beat
 * automation-hub/.env, which stays as the fallback for anything an environment does not define.
 *
 * Switching is the common case and now costs one click in the menu; the list dialog is for
 * managing. The list and the form are never open at once — opening the form closes the list and
 * closing it brings the list back — because two stacked dialogs read as one broken card.
 *
 * Settings → Automation has the same list in a card. Both go through
 * components/environments/* so they cannot disagree.
 */
export function EnvironmentSwitcher({
  app,
  onActiveChange,
}: {
  app: string
  /**
   * Fires with the active environment's name (null when none is active and .env decides).
   * The Hub needs it to report each automation's status for the environment you are pointed
   * at, rather than whichever server happened to run last.
   */
  onActiveChange?: (name: string | null) => void
}) {
  const mgr = useEnvironmentManager(app, onActiveChange)
  const { envs, active, busy } = mgr
  const [managing, setManaging] = useState(false)
  /** Whether closing the form should hand you back to the list you came from. */
  const [returnToList, setReturnToList] = useState(false)

  /** Drill down into the form: the list steps aside rather than stacking behind it. */
  const openForm = (open: () => void, fromList: boolean) => {
    setManaging(false)
    setReturnToList(fromList)
    open()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          title="Choose which server the automation runs against"
          // Sized to match the ModelSelector sitting beside it in the Hub header — same height,
          // same radius, same chevron. The old bespoke button was 8px shorter than its
          // neighbour and had no affordance saying it opened anything.
          className={cn(
            'flex h-8 w-full min-w-[180px] items-center justify-between gap-1.5 rounded-lg border border-input',
            'bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none',
            'hover:bg-accent/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
            'dark:bg-input/30 dark:hover:bg-input/50',
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Server className="size-3.5 shrink-0 text-muted-foreground" />
            {envs === null
              ? <span className="text-muted-foreground">Loading…</span>
              : active
                ? <span className="truncate font-medium">{active.name}</span>
                // No environment means .env decides, which is invisible — say so rather than
                // showing a reassuring blank.
                : <span className="truncate text-amber-600 dark:text-amber-400">Using .env</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" sideOffset={6} className="w-[300px]">
          {/* GroupLabel only has a label to attach to inside a Group — Base UI throws without
              one, so the heading and the environments it names live in the same group. */}
          <DropdownMenuGroup>
            <DropdownMenuLabel>Runs against</DropdownMenuLabel>

            {envs?.length === 0 && (
              <p className="px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
                No environments yet — runs use <code>automation-hub/.env</code>.
              </p>
            )}

            {envs?.map((e) => (
              <DropdownMenuItem
                key={e.id}
                disabled={busy}
                onClick={() => { if (!e.isActive) mgr.activate(e.id) }}
                className="items-start gap-2"
              >
                {/* The check keeps a fixed slot on every row so names stay left-aligned. */}
                <Check className={cn('mt-0.5 size-4 shrink-0', !e.isActive && 'invisible')} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate', e.isActive && 'font-medium')}>{e.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {e.keys.length} variable{e.keys.length === 1 ? '' : 's'}
                    {e.description ? ` · ${e.description}` : ''}
                  </span>
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openForm(mgr.startNew, false)}>
            <Plus /> New environment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setManaging(true)}>
            <Settings2 /> Manage environments…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={managing} onOpenChange={setManaging}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> Environments
            </DialogTitle>
            <DialogDescription>
              Where this app&apos;s automation runs. The active environment&apos;s variables are
              applied to every run and override <code>automation-hub/.env</code>; anything it
              does not define still falls back to that file.
            </DialogDescription>
          </DialogHeader>

          {/* Only the list scrolls, so "New environment" stays put however many there are. */}
          <div className="max-h-[60vh] overflow-y-auto">
            <EnvironmentList
              envs={envs}
              busy={busy}
              onActivate={mgr.activate}
              onEdit={(id) => openForm(() => mgr.startEdit(id), true)}
              onDelete={mgr.remove}
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" className="gap-1"
                    onClick={() => openForm(mgr.startNew, true)}>
              <Plus className="h-4 w-4" /> New environment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EnvironmentFormDialog mgr={mgr} onClosed={() => { if (returnToList) setManaging(true) }} />
    </>
  )
}
