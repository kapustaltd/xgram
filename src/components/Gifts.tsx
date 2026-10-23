import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { EyeOff, Link2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { compact, fullDate, fullNumber, pluralRu } from '../lib/format'
import { errorText, useApi } from '../store'
import type { Gift, GiftAttribute } from '../tg/types'
import { Avatar } from './Avatar'
import { PeerName, peerPath } from './PeerName'
import { StickerView } from './Sticker'
import { Button, EmptyState, Modal, ModalClose, Spinner, StarsIcon } from './ui'

const rarity = (a: GiftAttribute) => `${(a.rarityPermille / 10).toLocaleString('ru', { maximumFractionDigits: 1 })}%`

/** Gradient backdrop + scattered pattern icons, as Telegram draws unique gifts. */
function Backdrop({ gift, children, className, dense }: { gift: Gift; children: ReactNode; className?: string; dense?: boolean }) {
  const b = gift.unique?.backdrop
  const pattern = gift.unique?.pattern?.sticker
  // fixed positions (percent) around the centre
  const spots = dense
    ? [[12, 14], [82, 12], [8, 56], [88, 52], [22, 86], [74, 86], [48, 6], [50, 92], [30, 34], [68, 32]]
    : [[14, 16], [80, 14], [10, 60], [86, 58], [30, 86], [70, 86]]
  return (
    <div
      className={cn('relative overflow-hidden', !b && 'bg-surface-2', className)}
      style={b ? { background: `radial-gradient(circle at 50% 45%, ${b.center}, ${b.edge})` } : undefined}
    >
      {pattern &&
        spots.map(([x, y], i) => (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 opacity-25 mix-blend-luminosity" style={{ left: `${x}%`, top: `${y}%` }}>
            <StickerView media={pattern} size={dense ? 26 : 18} preview />
          </div>
        ))}
      {children}
    </div>
  )
}

function Ribbon({ children, gift }: { children: ReactNode; gift: Gift }) {
  const b = gift.unique?.backdrop
  return (
    <span
      className={cn('absolute end-1.5 top-1.5 z-10 rounded-full px-1.5 py-0.5 text-subtext3 font-bold', !b && 'bg-brand text-white')}
      style={b ? { background: `${b.edge}cc`, color: b.text } : undefined}
    >
      {children}
    </span>
  )
}

function GiftCard({ gift, onOpen }: { gift: Gift; onOpen: () => void }) {
  const api = useApi()
  const sender = gift.fromId ? api.peerSync(gift.fromId) : undefined
  const ribbon = gift.unique
    ? `#${fullNumber(gift.unique.num)}`
    : gift.limited?.total
      ? `1 из ${compact(gift.limited.total)}`
      : null
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex aspect-[4/5] flex-col overflow-hidden rounded-md border border-divider text-left transition hover:-translate-y-0.5 hover:border-normal',
        gift.unsaved && 'opacity-60',
      )}
    >
      <Backdrop gift={gift} className="flex flex-1 items-center justify-center">
        {sender && !gift.nameHidden && (
          <span className="absolute start-1.5 top-1.5 z-10">
            <Avatar peer={sender} size={22} />
          </span>
        )}
        {gift.unsaved && (
          <span className="absolute start-1.5 bottom-1.5 z-10 rounded-full bg-black/50 p-1 text-white" title="Скрыт из профиля">
            <EyeOff className="size-3" />
          </span>
        )}
        {ribbon && <Ribbon gift={gift}>{ribbon}</Ribbon>}
        {gift.sticker ? <StickerView media={gift.sticker} size={84} preview className="relative z-[1] transition-transform group-hover:scale-105" /> : <span className="text-[48px]">🎁</span>}
      </Backdrop>
      <div className="flex h-9 shrink-0 items-center justify-center gap-1 bg-surface px-2 text-subtext1 font-bold">
        {gift.unique ? (
          <span className="truncate">{gift.unique.title}</span>
        ) : (
          <>
            <StarsIcon /> <span className="tabular-nums">{fullNumber(gift.stars ?? 0)}</span>
          </>
        )}
      </div>
    </button>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-divider py-2.5 text-body last:border-0">
      <span className="shrink-0 text-secondary">{label}</span>
      <span className="min-w-0 text-right">{children}</span>
    </div>
  )
}

function GiftDialog({ gift, onClose }: { gift: Gift; onClose: () => void }) {
  const api = useApi()
  const navigate = useNavigate()
  const sender = gift.fromId ? api.peerSync(gift.fromId) : undefined
  const u = gift.unique
  const textColor = u?.backdrop?.text
  return (
    <Modal open onClose={onClose} label="Подарок" className="sm:max-w-[440px]">
      <Backdrop gift={gift} dense className="flex h-[280px] shrink-0 flex-col items-center justify-end pb-5">
        <ModalClose onClose={onClose} className="absolute start-2 top-2 z-10 bg-black/30 text-white hover:bg-black/50" />
        {gift.sticker ? <StickerView media={gift.sticker} size={150} className="relative z-[1]" /> : <span className="text-[96px]">🎁</span>}
        <div className="relative z-[1] mt-2 text-center" style={textColor ? { color: textColor } : undefined}>
          <div className="text-headline1 font-extrabold">{u ? u.title : 'Подарок'}</div>
          {u ? (
            <div className="text-subtext1 opacity-80">Коллекционный подарок #{fullNumber(u.num)}</div>
          ) : (
            gift.stars != null && (
              <div className="flex items-center justify-center gap-1 text-subtext1 text-secondary">
                <StarsIcon /> {fullNumber(gift.stars)} {pluralRu(gift.stars, 'звезда', 'звезды', 'звёзд')}
              </div>
            )
          )}
        </div>
      </Backdrop>
      <div className="overflow-y-auto px-5 pt-2 pb-5">
        <Row label="От">
          {gift.nameHidden || !sender ? (
            <span className="text-secondary">{gift.nameHidden ? 'Скрытый отправитель' : 'Неизвестно'}</span>
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate(peerPath(sender))
              }}
              className="inline-flex items-center gap-2"
            >
              <Avatar peer={sender} size={22} />
              <PeerName peer={sender} link={false} handle={false} />
            </button>
          )}
        </Row>
        <Row label="Дата">{fullDate(gift.date)}</Row>
        {u?.model && (
          <Row label="Модель">
            {u.model.name} <span className="text-secondary">· {rarity(u.model)}</span>
          </Row>
        )}
        {u?.backdrop && (
          <Row label="Фон">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ background: `radial-gradient(${u.backdrop.center}, ${u.backdrop.edge})` }} />
              {u.backdrop.name} <span className="text-secondary">· {rarity(u.backdrop)}</span>
            </span>
          </Row>
        )}
        {u?.pattern && (
          <Row label="Узор">
            {u.pattern.name} <span className="text-secondary">· {rarity(u.pattern)}</span>
          </Row>
        )}
        {u && (
          <Row label="Выпущено">
            {fullNumber(u.issued)} из {fullNumber(u.total)}
          </Row>
        )}
        {!u && gift.limited?.total != null && (
          <Row label="Доступно">
            {gift.limited.remains ? `${fullNumber(gift.limited.remains)} из ${fullNumber(gift.limited.total)}` : <span className="text-x-red">Распродан</span>}
          </Row>
        )}
        {!u && gift.convertStars != null && gift.convertStars > 0 && (
          <Row label="Можно обменять на">
            <span className="inline-flex items-center gap-1">
              <StarsIcon /> {fullNumber(gift.convertStars)}
            </span>
          </Row>
        )}
        {gift.canUpgrade && gift.upgradeStars != null && (
          <Row label="Улучшение">
            <span className="inline-flex items-center gap-1">
              <StarsIcon /> {fullNumber(gift.upgradeStars)} до уникального
            </span>
          </Row>
        )}
        {gift.unsaved && <Row label="Видимость">Скрыт из профиля</Row>}
        {gift.message && <p className="mt-3 rounded-md bg-hover-subtle px-4 py-3 text-body whitespace-pre-wrap">{gift.message}</p>}
        {u && (
          <Button variant="outline" className="mt-4 w-full" onClick={() => window.open(`https://t.me/nft/${u.slug}`, '_blank', 'noopener')}>
            <Link2 className="size-4" /> t.me/nft/{u.slug}
          </Button>
        )}
      </div>
    </Modal>
  )
}

/** Profile "Подарки" tab: paged grid of saved star gifts. */
export function GiftsGrid({ peerId }: { peerId: string }) {
  const api = useApi()
  const [gifts, setGifts] = useState<Gift[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [next, setNext] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Gift | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  const load = useCallback(
    async (offset?: string) => {
      setLoading(true)
      setError(null)
      try {
        const page = await api.getGifts(peerId, offset)
        setGifts((g) => (offset ? [...g, ...page.gifts] : page.gifts))
        setCount(page.count)
        setNext(page.nextOffset)
      } catch (e) {
        setError(errorText(e))
      } finally {
        setLoading(false)
      }
    },
    [api, peerId],
  )

  useEffect(() => {
    setGifts([])
    setCount(null)
    setNext(undefined)
    load()
  }, [load])

  useEffect(() => {
    const el = sentinel.current
    if (!el || !next || loading) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && load(next), { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [next, loading, load])

  if (error && !gifts.length) return <EmptyState title="Не удалось загрузить подарки" text={error} action={<Button onClick={() => load()}>Повторить</Button>} />
  if (count === 0) return <EmptyState title="Подарков пока нет" text="Подарки, полученные в Telegram и сохранённые в профиле, появятся здесь." />

  return (
    <div className="px-4 py-3">
      {count != null && (
        <div className="pb-3 text-body text-secondary">
          {fullNumber(count)} {pluralRu(count, 'подарок', 'подарка', 'подарков')}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {gifts.map((g) => (
          <GiftCard key={g.id} gift={g} onOpen={() => setOpen(g)} />
        ))}
      </div>
      {loading && <Spinner />}
      <div ref={sentinel} className="h-px" />
      {open && <GiftDialog gift={open} onClose={() => setOpen(null)} />}
    </div>
  )
}
