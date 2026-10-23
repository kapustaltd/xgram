import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, MapPin, Mic, Music, Play, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { duration, fileSize, fullNumber, pluralRu } from '../lib/format'
import { useThumb } from '../lib/useMedia'
import { GifView, StickerView } from './Sticker'
import type { Media } from '../tg/types'

const VISUAL = new Set(['photo', 'video', 'gif'])

function Tile({ media, className, onOpen }: { media: Media; className?: string; onOpen: () => void }) {
  const src = useThumb(media)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className={cn('relative block size-full overflow-hidden bg-surface-2', className)}
    >
      {media.kind === 'gif' ? (
        <GifView media={media} />
      ) : src ? (
        <img src={src} alt="" draggable={false} className="size-full object-cover" loading="lazy" />
      ) : (
        <div className="size-full animate-pulse bg-hover-subtle" />
      )}
      {media.kind === 'video' && (
        <>
          <span className="absolute inset-0 m-auto flex size-[58px] items-center justify-center rounded-full border-4 border-white bg-brand text-white">
            <Play className="ms-1 size-7 fill-current" />
          </span>
          <span className="absolute start-3 bottom-3 rounded-xs bg-black/75 px-1 text-subtext2 font-bold text-white">{duration(media.duration)}</span>
        </>
      )}
      {media.kind === 'gif' && <span className="absolute start-3 bottom-3 rounded-xs bg-black/75 px-1 text-subtext2 font-bold text-white">GIF</span>}
    </button>
  )
}

/** X-style 1–4 image grid (rounded-md, 2px gutters). */
function VisualGrid({ items, onOpen }: { items: Media[]; onOpen: (i: number) => void }) {
  const list = items.slice(0, 4)
  if (list.length === 1) {
    const m = list[0]
    const ratio = m.width && m.height ? m.width / m.height : 16 / 9
    return (
      <div className="w-fit max-w-full overflow-hidden rounded-md border border-normal">
        <div style={{ aspectRatio: Math.min(Math.max(ratio, 0.75), 2.5) }} className="max-h-[510px] w-[min(100vw,516px)] max-w-full">
          <Tile media={m} onOpen={() => onOpen(0)} />
        </div>
      </div>
    )
  }
  return (
    <div
      className={cn(
        'grid aspect-video gap-0.5 overflow-hidden rounded-md border border-normal',
        list.length === 2 && 'grid-cols-2',
        list.length >= 3 && 'grid-cols-2 grid-rows-2',
      )}
    >
      {list.map((m, i) => (
        <Tile key={i} media={m} onOpen={() => onOpen(i)} className={cn(list.length === 3 && i === 0 && 'row-span-2')} />
      ))}
    </div>
  )
}

function LinkCard({ media }: { media: Media }) {
  const src = useThumb(media.width ? media : undefined)
  const host = media.siteName ?? (media.url ? new URL(media.url).hostname.replace(/^www\./, '') : '')
  if (src) {
    return (
      <div className="flex flex-col gap-1">
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="relative block overflow-hidden rounded-md border border-normal bg-surface-2"
        >
          <div style={{ aspectRatio: media.width && media.height ? Math.max(media.width / media.height, 1.2) : 1.91 }}>
            <img src={src} alt="" className="size-full object-cover" loading="lazy" />
          </div>
          {media.title && (
            <div className="absolute inset-x-3 bottom-3">
              <div className="inline-flex h-5 max-w-full items-center rounded-xs bg-black/75 px-2">
                <div className="line-clamp-1 text-subtext2 text-white">{media.title}</div>
              </div>
            </div>
          )}
        </a>
        <a href={media.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-fit text-subtext2 text-secondary hover:underline">
          Из {host}
        </a>
      </div>
    )
  }
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col gap-0.5 rounded-md border border-normal px-3 py-2.5 transition-colors hover:bg-hover-faint"
    >
      <span className="text-subtext2 text-secondary">{host}</span>
      {media.title && <span className="line-clamp-1 text-body">{media.title}</span>}
      {media.description && <span className="line-clamp-2 text-subtext1 text-secondary">{media.description}</span>}
    </a>
  )
}

function Poll({ media }: { media: Media }) {
  const answers = media.pollAnswers ?? []
  const total = answers.reduce((s, a) => s + (a.voters ?? 0), 0)
  const max = Math.max(...answers.map((a) => a.voters ?? 0))
  return (
    <div className="flex flex-col gap-1.5">
      {media.pollQuestion && <div className="text-body font-bold">{media.pollQuestion}</div>}
      {answers.map((a, i) => {
        const pct = total ? Math.round(((a.voters ?? 0) / total) * 100) : 0
        const win = total > 0 && a.voters === max
        return (
          <div key={i} className="relative flex h-8 items-center justify-between overflow-hidden rounded-xs px-3 text-body">
            <div className={cn('absolute inset-y-0 start-0 rounded-xs', win ? 'bg-brand/40' : 'bg-hover-subtle')} style={{ width: `${Math.max(pct, 1)}%` }} />
            <span className={cn('relative truncate', win && 'font-bold')}>{a.text}</span>
            <span className={cn('relative ps-2', win && 'font-bold')}>{total ? `${pct}%` : ''}</span>
          </div>
        )
      })}
      <div className="text-body text-secondary">
        {fullNumber(total)} {pluralRu(total, 'голос', 'голоса', 'голосов')}
      </div>
    </div>
  )
}

function FileRow({ media }: { media: Media }) {
  const Icon = media.kind === 'voice' ? Mic : media.kind === 'audio' ? Music : media.kind === 'geo' ? MapPin : FileText
  const title =
    media.kind === 'voice'
      ? 'Голосовое сообщение'
      : media.kind === 'geo'
        ? (media.title ?? 'Геопозиция')
        : (media.title ?? media.fileName ?? 'Файл')
  const sub = media.duration ? duration(media.duration) : media.size ? fileSize(media.size) : ''
  return (
    <div className="flex items-center gap-3 rounded-md border border-normal p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-bold">{title}</span>
        {sub && <span className="text-subtext2 text-secondary">{sub}</span>}
      </span>
    </div>
  )
}


export function MediaBlock({ media, link }: { media: Media[]; link?: string | null }) {
  const [open, setOpen] = useState<number | null>(null)
  if (!media.length) return null
  const visual = media.filter((m) => VISUAL.has(m.kind))
  const other = media.filter((m) => !VISUAL.has(m.kind))
  return (
    <div className="flex flex-col gap-3 empty:hidden">
      {visual.length > 0 && <VisualGrid items={visual} onOpen={setOpen} />}
      {other.map((m, i) =>
        m.kind === 'webpage' ? (
          <LinkCard key={i} media={m} />
        ) : m.kind === 'poll' ? (
          <Poll key={i} media={m} />
        ) : m.kind === 'sticker' ? (
          <StickerView key={i} media={m} />
        ) : (
          <FileRow key={i} media={m} />
        ),
      )}
      {open != null && <Lightbox items={visual} index={open} onClose={() => setOpen(null)} link={link} />}
    </div>
  )
}

function Lightbox({ items, index, onClose, link }: { items: Media[]; index: number; onClose: () => void; link?: string | null }) {
  const [i, setI] = useState(index)
  const media = items[i]
  const src = useThumb(media)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => Math.min(items.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [items.length, onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <button type="button" aria-label="Закрыть" className="x-button absolute start-3 top-3 size-9 bg-black/60 text-white hover:bg-black/80" onClick={onClose}>
        <X className="size-5" />
      </button>
      {src && <img src={src} alt="" className="max-h-[90vh] max-w-[95vw] object-contain" onClick={(e) => e.stopPropagation()} />}
      {media.kind !== 'photo' && (
        <div className="absolute inset-x-0 bottom-8 flex justify-center" onClick={(e) => e.stopPropagation()}>
          <span className="rounded-full bg-black/70 px-4 py-2 text-body text-white">
            {link ? (
              <a href={link} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Видео открывается в Telegram →
              </a>
            ) : (
              'Предпросмотр видео'
            )}
          </span>
        </div>
      )}
      {items.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-subtext1 text-white">
          {i + 1} / {items.length}
        </div>
      )}
    </div>,
    document.body,
  )
}
