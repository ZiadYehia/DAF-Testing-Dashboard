'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

export interface LightboxItem {
  src: string
  name: string
  isVideo: boolean
}

const ZOOM_MIN = 1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.25
const SWIPE_THRESHOLD = 50

/**
 * Reusable full-screen viewer for images and videos.
 * - Prev/next via arrows, on-screen buttons, or swipe (when not zoomed)
 * - Images: zoom (buttons / wheel / +-/ double-click) and drag-to-pan; recenters at 100%
 * - Videos: inline player (autoplay + controls)
 * `index === null` means closed.
 */
export function Lightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: LightboxItem[]
  index: number | null
  onClose: () => void
  onIndexChange: (i: number) => void
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const panStart = useRef({ x: 0, y: 0 })
  const hasDragged = useRef(false)
  const touchStartX = useRef<number | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  const open = index !== null && index >= 0 && index < items.length
  const item = open ? items[index] : null
  const isImage = !!item && !item.isVideo

  const clamp = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
  const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }) }, [])

  const go = useCallback((dir: number) => {
    if (index === null) return
    const next = index + dir
    if (next < 0 || next >= items.length) return
    resetView()
    onIndexChange(next)
  }, [index, items.length, onIndexChange, resetView])

  // Reset zoom/pan whenever the shown item changes
  useEffect(() => { resetView() }, [index, resetView])

  // Recenter the image whenever zoom returns to 100%
  useEffect(() => { if (zoom === ZOOM_MIN) setPan({ x: 0, y: 0 }) }, [zoom])

  // Keyboard: Esc (un-zoom or close), arrows navigate, +/- zoom
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': if (zoom > 1) resetView(); else onClose(); break
        case 'ArrowLeft': go(-1); break
        case 'ArrowRight': go(1); break
        case '+': case '=': setZoom((z) => clamp(z + ZOOM_STEP)); break
        case '-': case '_': setZoom((z) => clamp(z - ZOOM_STEP)); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, zoom, go, onClose, resetView])

  // Non-passive wheel zoom for images (also prevents background scroll)
  useEffect(() => {
    const el = backdropRef.current
    if (!el || !open || !isImage) return
    const h = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => clamp(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)))
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [open, isImage])

  if (!open || !item) return null
  const hasMany = items.length > 1

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    dragStart.current = { x: e.clientX, y: e.clientY }
    panStart.current = { ...pan }
    hasDragged.current = false
    setDragging(true)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasDragged.current = true
    setPan({ x: panStart.current.x + dx, y: panStart.current.y + dy })
  }
  const onMouseUp = () => setDragging(false)
  const onBackdropClick = (e: React.MouseEvent) => {
    if (hasDragged.current) { hasDragged.current = false; return }
    if (e.target !== e.currentTarget) return
    if (zoom === 1) onClose()
  }
  const onTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || zoom !== 1) { touchStartX.current = null; return }
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? 1 : -1)
    touchStartX.current = null
  }

  return (
    <div
      ref={backdropRef}
      className={`fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 ${
        isImage && zoom > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
      }`}
      onClick={onBackdropClick}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/15 text-white hover:bg-white/30 flex items-center justify-center z-10"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Media */}
      {item.isVideo ? (
        <video
          src={item.src}
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
          className="max-w-[90vw] max-h-[82vh] rounded-lg shadow-2xl bg-black"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.src}
          alt={item.name}
          draggable={false}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => { e.stopPropagation(); zoom > 1 ? resetView() : setZoom(2) }}
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center center' }}
          className={`max-w-[90vw] max-h-[82vh] rounded-lg shadow-2xl select-none ${zoom > 1 ? '' : 'transition-transform duration-150 ease-out'}`}
        />
      )}

      {/* Prev / Next */}
      {hasMany && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1) }}
            disabled={index === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(1) }}
            disabled={index === items.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 text-white hover:bg-white/30 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Filename + counter */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
        <p className="text-white/70 text-sm break-all px-4 text-center">{item.name}</p>
        {hasMany && <p className="text-white/50 text-xs">{index + 1} / {items.length}</p>}
      </div>

      {/* Zoom toolbar (images only) */}
      {isImage && (
        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white/15 px-2 py-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => setZoom((z) => clamp(z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN}
            className="h-9 w-9 rounded-full text-white hover:bg-white/20 disabled:opacity-40 flex items-center justify-center" aria-label="Zoom out">
            <ZoomOut className="h-5 w-5" />
          </button>
          <span className="text-white/80 text-xs w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => clamp(z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX}
            className="h-9 w-9 rounded-full text-white hover:bg-white/20 disabled:opacity-40 flex items-center justify-center" aria-label="Zoom in">
            <ZoomIn className="h-5 w-5" />
          </button>
          <button onClick={resetView} disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
            className="h-9 w-9 rounded-full text-white hover:bg-white/20 disabled:opacity-40 flex items-center justify-center" aria-label="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
