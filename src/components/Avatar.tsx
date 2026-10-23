import { useEffect, useRef, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { cn } from '../lib/cn'
import { useApi, useApp } from '../store'
import type { Peer } from '../tg/types'

// Telegram's placeholder gradients, keyed by peer id.
const GRADIENTS = [
  ['#ff885e', '#ff516a'],
  ['#ffcd6a', '#ffa85c'],
  ['#e0a2f3', '#d669ed'],
  ['#a0de7e', '#54cb68'],
  ['#53edd6', '#28c9b7'],
  ['#72d5fd', '#2a9ef1'],
  ['#82b1ff', '#665fff'],
]

export function gradientFor(id: string) {
  const n = Math.abs(Number(id.replace(/\D/g, '').slice(-6)) || 0)
  return GRADIENTS[n % GRADIENTS.length]
}

function initials(title: string) {
  const words = title.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/)
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?'
}

export function useAvatarUrl(peerId: string | undefined) {
  const api = useApi()
  const version = useApp((s) => s.avatarVersion)
  const [src, setSrc] = useState<string | null>(null)
  const shownFor = useRef(peerId)
  useEffect(() => {
    let alive = true
    // Clear only when switching peers; on a photo-version bump keep the old image until the new one arrives.
    if (shownFor.current !== peerId) {
      shownFor.current = peerId
      setSrc(null)
    }
    if (peerId) api.getAvatar(peerId).then((u) => alive && setSrc(u))
    return () => {
      alive = false
    }
  }, [api, peerId, version])
  return src
}

export function Avatar({
  peer,
  size = 40,
  saved,
  className,
}: {
  peer: Peer | undefined
  size?: number
  /** Render as the "Saved Messages" bookmark avatar. */
  saved?: boolean
  className?: string
}) {
  const src = useAvatarUrl(saved ? undefined : peer?.id)
  // X renders organisations as rounded squares; channels are Telegram's closest analogue.
  const shape = peer?.kind === 'channel' ? 'rounded-[10%]' : 'rounded-full'
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) }
  if (saved) {
    return (
      <div className={cn('x-avatar flex items-center justify-center rounded-full bg-brand text-white', className)} style={style}>
        <Bookmark className="fill-current" style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    )
  }
  if (src) {
    return (
      <div className={cn('x-avatar shrink-0 overflow-hidden transition duration-200 hover:brightness-90', shape, className)} style={style}>
        <img src={src} alt="" draggable={false} className="size-full object-cover" />
      </div>
    )
  }
  const [a, b] = gradientFor(peer?.id ?? '0')
  return (
    <div
      className={cn('x-avatar flex shrink-0 select-none items-center justify-center font-bold text-white', shape, className)}
      style={{ ...style, background: `linear-gradient(180deg, ${a}, ${b})` }}
      aria-hidden
    >
      {peer ? initials(peer.title) : ''}
    </div>
  )
}
