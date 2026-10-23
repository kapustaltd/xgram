import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Clock, Star } from 'lucide-react'
import { cn } from '../lib/cn'
import { EMOJI_GROUPS, pushRecentEmoji, recentEmoji } from '../lib/emoji'
import { useAsync } from '../lib/useAsync'
import { useApi } from '../store'
import type { Media, StickerSet } from '../tg/types'
import { GifView, StickerView } from './Sticker'
import { Spinner } from './ui'

type Tab = 'emoji' | 'stickers' | 'gifs'

function EmojiTab({ onPick }: { onPick: (e: string) => void }) {
  const [recent, setRecent] = useState(recentEmoji)
  const scroller = useRef<HTMLDivElement>(null)
  const groups = recent.length ? [{ id: 'recent', label: 'Недавние', icon: '🕘', list: recent }, ...EMOJI_GROUPS] : EMOJI_GROUPS
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar flex shrink-0 gap-0.5 overflow-x-auto border-b border-divider px-2 py-1">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            title={g.label}
            onClick={() => scroller.current?.querySelector(`[data-group="${g.id}"]`)?.scrollIntoView({ block: 'start' })}
            className="x-button size-8 shrink-0 text-[18px] hover:bg-btn-ghost-hover"
          >
            {g.icon}
          </button>
        ))}
      </div>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {groups.map((g) => (
          <section key={g.id} data-group={g.id}>
            <h3 className="sticky top-0 bg-elevated px-1 pt-2 pb-1 text-subtext2 font-bold text-secondary">{g.label}</h3>
            <div className="grid grid-cols-8 gap-0.5">
              {g.list.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    pushRecentEmoji(e)
                    onPick(e)
                  }}
                  onMouseUp={() => setRecent(recentEmoji())}
                  className="flex aspect-square items-center justify-center rounded-xs text-[24px] leading-none hover:bg-btn-ghost-hover"
                >
                  {e}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function SetCover({ set, active, onClick }: { set: StickerSet; active: boolean; onClick: () => void }) {
  const api = useApi()
  const ref = useRef<HTMLButtonElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setVisible(true))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const { data } = useAsync(() => (visible && set.id !== 'recent' && set.id !== 'faved' ? api.getStickers(set.id) : Promise.resolve([])), [api, set.id, visible])
  const icon = set.id === 'recent' ? <Clock className="size-5" /> : set.id === 'faved' ? <Star className="size-5" /> : data?.[0] ? <StickerView media={data[0]} size={32} preview /> : null
  return (
    <button
      ref={ref}
      type="button"
      title={set.title}
      onClick={onClick}
      className={cn('x-button size-10 shrink-0 text-secondary', active ? 'bg-btn-ghost-pressed text-primary' : 'hover:bg-btn-ghost-hover')}
    >
      {icon ?? <span className="text-subtext3 font-bold">{set.title.slice(0, 2)}</span>}
    </button>
  )
}

function StickersTab({ onPick }: { onPick: (m: Media) => void }) {
  const api = useApi()
  const sets = useAsync(() => api.getStickerSets(), [api])
  const [setId, setSetId] = useState('recent')
  const stickers = useAsync(() => api.getStickers(setId), [api, setId])

  // Jump past empty "recent" on first open.
  useEffect(() => {
    if (setId === 'recent' && stickers.data && !stickers.data.length && sets.data && sets.data.length > 2) setSetId(sets.data[2].id)
  }, [setId, stickers.data, sets.data])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-divider px-2 py-1">
        {sets.data?.map((s) => <SetCover key={s.id} set={s} active={s.id === setId} onClick={() => setSetId(s.id)} />)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {(stickers.loading || sets.loading) && <Spinner />}
        {sets.error && <p className="p-4 text-center text-body text-secondary">{sets.error.message}</p>}
        {stickers.data && !stickers.data.length && <p className="p-4 text-center text-body text-secondary">Здесь пока пусто</p>}
        <div className="grid grid-cols-5 gap-1">
          {stickers.data?.map((m) => (
            <button key={m.key} type="button" onClick={() => onPick(m)} className="flex aspect-square items-center justify-center rounded-xs hover:bg-btn-ghost-hover">
              <StickerView media={m} size={60} preview />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function GifsTab({ onPick }: { onPick: (m: Media) => void }) {
  const api = useApi()
  const { data, loading, error } = useAsync(() => api.getSavedGifs(), [api])
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2">
      {loading && <Spinner />}
      {error && <p className="p-4 text-center text-body text-secondary">{error.message}</p>}
      {data && !data.length && <p className="p-4 text-center text-body text-secondary">Нет сохранённых GIF. Сохраните GIF в Telegram — он появится здесь.</p>}
      <div className="grid grid-cols-2 gap-1">
        {data?.map((m) => (
          <button key={m.key} type="button" onClick={() => onPick(m)} className="aspect-video overflow-hidden rounded-xs hover:opacity-80">
            <GifView media={m} preview />
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Emoji / sticker / GIF panel anchored above an input.
 * Emoji clicks keep the panel open; sending a sticker or GIF closes it.
 */
export function EmojiPicker({
  onEmoji,
  onDocument,
  onClose,
  className,
  anchor,
}: {
  /** Render in a portal next to this element (escapes overflow-hidden parents such as modals). */
  anchor?: RefObject<HTMLElement | null>
  onEmoji: (e: string) => void
  /** Omit to show emoji only (e.g. in the post composer). */
  onDocument?: (m: Media) => void
  onClose: () => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>(() => (onDocument ? ((sessionStorage.getItem('xg:picker-tab') as Tab) ?? 'emoji') : 'emoji'))

  useEffect(() => {
    sessionStorage.setItem('xg:picker-tab', tab)
  }, [tab])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-picker-toggle]')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useLayoutEffect(() => {
    const el = anchor?.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const h = 420
    const top = r.bottom + 4 + h < window.innerHeight ? r.bottom + 4 : Math.max(8, r.top - h - 4)
    setPos({ left: Math.min(r.left, window.innerWidth - 368), top })
  }, [anchor])

  const pickDoc = (m: Media) => {
    onDocument?.(m)
    onClose()
  }

  const panel = (
    <div
      ref={ref}
      style={pos ? { position: 'fixed', left: Math.max(8, pos.left), top: pos.top } : undefined}
      className={cn(
        'animate-x-in z-[60] flex h-[420px] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-md bg-elevated shadow-popup',
        !anchor && 'absolute',
        className,
      )}
    >
      {onDocument && (
        <div className="flex shrink-0 gap-1 p-2">
          {(
            [
              ['emoji', 'Эмодзи'],
              ['stickers', 'Стикеры'],
              ['gifs', 'GIF'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn('x-button h-8 flex-1 text-subtext1', tab === id ? 'bg-btn-primary text-inverted' : 'text-primary hover:bg-btn-ghost-hover')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === 'emoji' && <EmojiTab onPick={onEmoji} />}
      {tab === 'stickers' && <StickersTab onPick={pickDoc} />}
      {tab === 'gifs' && <GifsTab onPick={pickDoc} />}
    </div>
  )
  if (!anchor) return panel
  return pos ? createPortal(panel, document.body) : null
}
