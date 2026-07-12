'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Check, Loader2 } from 'lucide-react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSelectOption<T extends string = string> {
  value: T
  label: string
  description?: string
  icon?: React.ReactNode
  badgeClassName?: string
  disabled?: boolean
  keywords?: string
}

export interface AppSelectGroup<T extends string = string> {
  label: string
  icon?: React.ReactNode
  options: AppSelectOption<T>[]
}

type AppSelectItems<T extends string> = AppSelectOption<T>[] | AppSelectGroup<T>[]

function isGrouped<T extends string>(items: AppSelectItems<T>): items is AppSelectGroup<T>[] {
  return items.length > 0 && 'options' in items[0]
}

function flattenOptions<T extends string>(items: AppSelectItems<T>): AppSelectOption<T>[] {
  if (!isGrouped(items)) return items as AppSelectOption<T>[]
  return (items as AppSelectGroup<T>[]).flatMap((g) => g.options)
}

interface AppSelectBaseProps<T extends string> {
  options: AppSelectItems<T>
  value: T | null
  onChange: (value: T) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  className?: string
  contentClassName?: string
  id?: string
  name?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom'
  'aria-label'?: string
}

type DefaultVariantProps = {
  variant?: 'default'
  size?: 'sm' | 'default'
}

type InlineVariantProps = {
  variant: 'inline'
  triggerBadgeClassName?: string
  showChevron?: boolean
  allowClear?: boolean
  onClear?: () => void
}

export type AppSelectProps<T extends string> = AppSelectBaseProps<T> &
  (DefaultVariantProps | InlineVariantProps)

const DEFAULT_BADGE =
  'bg-zinc-100 text-zinc-600 border-zinc-200/70 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/20'

// ─── Component ────────────────────────────────────────────────────────────────

export function AppSelect<T extends string = string>(props: AppSelectProps<T>) {
  const {
    options,
    value,
    onChange,
    placeholder = 'Select…',
    disabled,
    loading,
    className,
    contentClassName,
    id,
    name,
    align = 'start',
    side = 'bottom',
    'aria-label': ariaLabel,
  } = props

  const isInline = props.variant === 'inline'
  const size = !isInline ? ((props as DefaultVariantProps).size ?? 'default') : undefined
  const inlineProps = isInline ? (props as InlineVariantProps) : null
  const showChevron = inlineProps?.showChevron ?? true
  const allowClear = inlineProps?.allowClear ?? false
  const onClear = inlineProps?.onClear

  const allFlat = flattenOptions(options)
  const selectedOpt = value != null ? (allFlat.find((o) => o.value === value) ?? null) : null
  const badgeCls = inlineProps?.triggerBadgeClassName ?? selectedOpt?.badgeClassName ?? DEFAULT_BADGE

  function handleValueChange(v: T | null) {
    if (v != null) onChange(v)
  }

  // ── Item ──────────────────────────────────────────────────────────────────

  function renderItem(opt: AppSelectOption<T>) {
    return (
      <SelectPrimitive.Item
        key={opt.value}
        value={opt.value}
        label={opt.label}
        disabled={opt.disabled}
        className={cn(
          'relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none',
          'transition-colors data-highlighted:bg-accent data-highlighted:text-accent-foreground',
          'data-[selected]:bg-accent/40 data-[selected]:text-foreground',
          'data-disabled:pointer-events-none data-disabled:opacity-50',
        )}
      >
        <SelectPrimitive.ItemText className="flex flex-1 min-w-0">
          {isInline ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                opt.badgeClassName ?? DEFAULT_BADGE,
              )}
            >
              {opt.label}
            </span>
          ) : (
            <span className="flex items-start gap-2 min-w-0">
              {opt.icon && (
                <span className="mt-0.5 shrink-0 text-muted-foreground [&>svg]:size-3.5">
                  {opt.icon}
                </span>
              )}
              <span className="flex flex-col min-w-0">
                <span className="leading-tight truncate">{opt.label}</span>
                {opt.description && (
                  <span className="text-xs text-muted-foreground leading-snug">
                    {opt.description}
                  </span>
                )}
              </span>
            </span>
          )}
        </SelectPrimitive.ItemText>
        <SelectPrimitive.ItemIndicator
          render={
            <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-primary" />
          }
        >
          <Check className="size-3.5 pointer-events-none" />
        </SelectPrimitive.ItemIndicator>
      </SelectPrimitive.Item>
    )
  }

  // ── Items list ────────────────────────────────────────────────────────────

  function renderItems() {
    if (!isGrouped(options)) {
      return (options as AppSelectOption<T>[]).map(renderItem)
    }
    return (options as AppSelectGroup<T>[]).map((group, gi) => (
      <React.Fragment key={group.label}>
        {gi > 0 && (
          <SelectPrimitive.Separator className="pointer-events-none -mx-1 my-1 h-px bg-border" />
        )}
        <SelectPrimitive.Group className="scroll-my-1 px-0.5">
          <SelectPrimitive.GroupLabel className="flex items-center gap-1.5 px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {group.icon && <span className="[&>svg]:size-3">{group.icon}</span>}
            {group.label}
          </SelectPrimitive.GroupLabel>
          {group.options.map(renderItem)}
        </SelectPrimitive.Group>
      </React.Fragment>
    ))
  }

  return (
    // `null` must be passed through as-is: Base UI treats `undefined` as
    // "uncontrolled", so mapping the empty value to undefined makes a Select that
    // starts empty mount uncontrolled and flip to controlled on first selection
    // (React warning). `null` is Base UI's controlled empty value.
    <SelectPrimitive.Root
      value={value}
      onValueChange={handleValueChange}
      name={name}
      disabled={disabled || loading}
    >
      {/* ── Default trigger ──────────────────────────────────────────────── */}
      {!isInline && (
        <SelectPrimitive.Trigger
          id={id}
          data-size={size}
          aria-label={ariaLabel}
          className={cn(
            'flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap',
            'transition-colors outline-none select-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'data-placeholder:text-muted-foreground',
            'data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)]',
            'dark:bg-input/30 dark:hover:bg-input/50',
            // open-state ring
            '[&[data-popup-open]]:border-ring [&[data-popup-open]]:ring-2 [&[data-popup-open]]:ring-ring/30',
            'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30',
            // chevron rotation
            '[&[data-popup-open]>svg:last-child]:rotate-180 [&>svg:last-child]:transition-transform [&>svg:last-child]:duration-200',
            loading && 'cursor-wait',
            className,
          )}
        >
          <SelectPrimitive.Value className="flex flex-1 text-left items-center gap-1.5 line-clamp-1">
            {loading ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : selectedOpt ? (
              <span className="flex items-center gap-1.5 min-w-0">
                {selectedOpt.icon && (
                  <span className="shrink-0 text-muted-foreground [&>svg]:size-3.5">
                    {selectedOpt.icon}
                  </span>
                )}
                <span className="truncate">{selectedOpt.label}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </SelectPrimitive.Value>
          {loading ? (
            <Loader2 className="size-3.5 shrink-0 text-muted-foreground animate-spin motion-reduce:animate-none" />
          ) : (
            <ChevronDown className="pointer-events-none size-4 shrink-0 text-muted-foreground" />
          )}
        </SelectPrimitive.Trigger>
      )}

      {/* ── Inline (badge) trigger ───────────────────────────────────────── */}
      {isInline && (
        <SelectPrimitive.Trigger
          id={id}
          aria-label={ariaLabel}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium cursor-pointer',
            'transition-[opacity,box-shadow] hover:opacity-85 focus:outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
            '[&[data-popup-open]]:ring-2 [&[data-popup-open]]:ring-ring/40 [&[data-popup-open]]:ring-offset-1 [&[data-popup-open]]:ring-offset-background',
            '[&[data-popup-open]>svg:last-child]:rotate-180 [&>svg:last-child]:transition-transform [&>svg:last-child]:duration-200',
            'disabled:cursor-not-allowed disabled:opacity-50',
            badgeCls,
            className,
          )}
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
          ) : (
            <span className={!selectedOpt ? 'opacity-60' : ''}>{selectedOpt?.label ?? placeholder}</span>
          )}
          {showChevron && !loading && (
            <ChevronDown className="pointer-events-none size-3 opacity-60 shrink-0" />
          )}
        </SelectPrimitive.Trigger>
      )}

      {/* ── Popup ────────────────────────────────────────────────────────── */}
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          side={side}
          sideOffset={4}
          align={align}
          alignItemWithTrigger={false}
          className="isolate z-50"
        >
          <SelectPrimitive.Popup
            className={cn(
              'relative isolate z-50 flex flex-col max-h-(--available-height) origin-(--transform-origin)',
              'overflow-hidden rounded-xl bg-popover text-popover-foreground',
              'shadow-lg ring-1 ring-foreground/10 duration-100',
              'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
              'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
              contentClassName,
            )}
          >
            <SelectPrimitive.ScrollUpArrow className="top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 shrink-0">
              <ChevronUp className="size-4 text-muted-foreground" />
            </SelectPrimitive.ScrollUpArrow>

            <SelectPrimitive.List
              className={cn(
                'p-1.5 overflow-y-auto scrollbar-thin flex-1',
                isInline ? 'min-w-44' : 'min-w-(--anchor-width)',
              )}
            >
              {renderItems()}
              {allowClear && value && onClear && (
                <>
                  <SelectPrimitive.Separator className="pointer-events-none -mx-1 my-1 h-px bg-border" />
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      onClear()
                    }}
                    className="flex w-full items-center rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Clear
                  </button>
                </>
              )}
            </SelectPrimitive.List>

            <SelectPrimitive.ScrollDownArrow className="bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 shrink-0">
              <ChevronDown className="size-4 text-muted-foreground" />
            </SelectPrimitive.ScrollDownArrow>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
