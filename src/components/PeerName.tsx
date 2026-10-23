import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import type { Peer } from '../tg/types'
import { CustomEmoji } from './CustomEmoji'
import { PremiumBadge, VerifiedBadge } from './ui'

export const peerPath = (peer: Pick<Peer, 'id' | 'username'>) => (peer.username ? `/@${peer.username}` : `/u/${peer.id}`)

/** "Name ✓ @handle" row used in posts, lists and cards. */
export function PeerName({
  peer,
  link = true,
  handle = true,
  className,
  nameClass,
  statusSize = 18,
  animateStatus,
}: {
  peer: Peer
  link?: boolean
  handle?: boolean
  className?: string
  nameClass?: string
  statusSize?: number
  /** Play the emoji status continuously (profile header) instead of on hover. */
  animateStatus?: boolean
}) {
  const name = (
    <span className={cn('min-w-0 truncate font-bold text-primary', link && 'hover:underline', nameClass)}>{peer.title}</span>
  )
  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      {link ? (
        <Link to={peerPath(peer)} onClick={(e) => e.stopPropagation()} className="flex min-w-0 rounded-xs">
          {name}
        </Link>
      ) : (
        name
      )}
      {peer.verified && <VerifiedBadge />}
      {peer.emojiStatus ? (
        <CustomEmoji id={peer.emojiStatus} size={statusSize} animate={animateStatus} title="Эмодзи-статус" />
      ) : (
        !peer.verified && peer.premium && <PremiumBadge />
      )}
      {handle && peer.username && <span className="min-w-0 truncate text-secondary">@{peer.username}</span>}
    </span>
  )
}
