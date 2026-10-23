import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { cn } from '../lib/cn'
import { loadFeed, trendsFrom } from '../lib/feed'
import { compact, pluralRu } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { errorText, useApi, useApp } from '../store'
import type { Peer } from '../tg/types'
import { Avatar } from './Avatar'
import { PeerName, peerPath } from './PeerName'
import { Button, Spinner } from './ui'

export function SearchBox({ initial = '', autoFocus, onSubmit }: { initial?: string; autoFocus?: boolean; onSubmit?: (q: string) => void }) {
  const [q, setQ] = useState(initial)
  const navigate = useNavigate()
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        if (!q.trim()) return
        if (onSubmit) onSubmit(q.trim())
        else navigate(`/explore?q=${encodeURIComponent(q.trim())}`)
      }}
      className="group flex h-11 items-center gap-1 rounded-full border border-transparent bg-inputs px-4 focus-within:border-brand focus-within:bg-surface"
    >
      <Search className="size-[18.75px] shrink-0 text-secondary group-focus-within:text-brand" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Поиск"
        className="min-w-0 flex-1 bg-transparent px-2 text-body outline-none placeholder:text-secondary"
      />
    </form>
  )
}

export function Card({ title, children, more }: { title: string; children: ReactNode; more?: { to: string; label?: string } }) {
  return (
    <section className="overflow-hidden rounded-md border border-divider">
      <h2 className="px-4 pt-3 pb-1 text-headline1 font-extrabold">{title}</h2>
      <div className="flex flex-col">{children}</div>
      {more && (
        <Link to={more.to} className="block px-4 py-4 text-body text-brand transition-colors hover:bg-hover-faint">
          {more.label ?? 'Показать ещё'}
        </Link>
      )}
    </section>
  )
}

export function FollowButton({ peer, className }: { peer: Peer; className?: string }) {
  const api = useApi()
  const toast = useApp((s) => s.showToast)
  const [joined, setJoined] = useState(!!peer.joined)
  const [hover, setHover] = useState(false)
  if (peer.kind === 'user' || peer.kind === 'bot') return null
  return (
    <Button
      size="sm"
      variant={joined ? 'outline' : 'primary'}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(joined && hover && 'border-x-red/40 text-x-red hover:bg-x-red/10', 'min-w-[78px]', className)}
      onClick={async (e) => {
        e.stopPropagation()
        if (joined) {
          toast('Отписаться можно в приложении Telegram')
          return
        }
        try {
          await api.join(peer.id)
          setJoined(true)
          toast(`Вы подписались на «${peer.title}»`)
        } catch (err) {
          toast(errorText(err))
        }
      }}
    >
      {/* X's Russian locale: Читать / Читаю / Не читать */}
      {joined ? (hover ? 'Не читать' : peer.kind === 'channel' ? 'Читаю' : 'Участник') : peer.kind === 'channel' ? 'Читать' : 'Вступить'}
    </Button>
  )
}

export function PeerRow({ peer, right, sub, onClick }: { peer: Peer; right?: ReactNode; sub?: ReactNode; onClick?: () => void }) {
  const navigate = useNavigate()
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onClick ?? (() => navigate(peerPath(peer)))}
      onKeyDown={(e) => e.key === 'Enter' && (onClick ?? (() => navigate(peerPath(peer))))()}
      className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-hover-faint"
    >
      <Avatar peer={peer} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PeerName peer={peer} handle={false} link={false} />
        <span className="truncate text-body text-secondary">
          {sub ?? (peer.username ? `@${peer.username}` : peer.members ? `${compact(peer.members)} ${pluralRu(peer.members, 'подписчик', 'подписчика', 'подписчиков')}` : '')}
        </span>
      </div>
      {right ?? <FollowButton peer={peer} />}
    </div>
  )
}

function Trends() {
  const api = useApi()
  const { data, loading } = useAsync(() => loadFeed(api), [api])
  if (loading) return <Spinner />
  const trends = trendsFrom(data ?? [])
  if (!trends.length) {
    // no hashtags: show the busiest channels instead
    const counts = new Map<string, number>()
    for (const p of data ?? []) counts.set(p.peerId, (counts.get(p.peerId) ?? 0) + (p.views ?? 0))
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    return (
      <>
        {top.map(([peerId, views]) => {
          const peer = api.peerSync(peerId)
          if (!peer) return null
          return (
            <Link key={peerId} to={peerPath(peer)} className="flex flex-col px-4 py-3 transition-colors hover:bg-hover-faint">
              <span className="text-subtext2 text-secondary">Популярно в ваших каналах</span>
              <span className="text-body font-bold">{peer.title}</span>
              <span className="text-subtext2 text-secondary">{compact(views)} просмотров</span>
            </Link>
          )
        })}
      </>
    )
  }
  return (
    <>
      {trends.map((t) => (
        <Link key={t.tag} to={`/explore?q=${encodeURIComponent(t.tag)}`} className="flex flex-col px-4 py-3 transition-colors hover:bg-hover-faint">
          <span className="text-subtext2 text-secondary">Тренды · {api.peerSync(t.peerId)?.title}</span>
          <span className="text-body font-bold">{t.tag}</span>
          <span className="text-subtext2 text-secondary">
            {t.count} {pluralRu(t.count, 'пост', 'поста', 'постов')}
          </span>
        </Link>
      ))}
    </>
  )
}

function WhoToFollow() {
  const api = useApi()
  const { data, loading } = useAsync(() => api.getRecommendations(), [api])
  if (loading) return <Spinner />
  if (!data?.length) return <p className="px-4 py-3 text-body text-secondary">Рекомендаций пока нет</p>
  return (
    <>
      {data.slice(0, 3).map((p) => (
        <PeerRow key={p.id} peer={p} />
      ))}
    </>
  )
}

export function RightColumn({ search = true }: { search?: boolean }) {
  return (
    <aside className="hidden w-[350px] shrink-0 ps-[30px] lg:block xl:ps-[30px]">
      <div className="sticky top-0 flex flex-col gap-4 pb-16">
        {search && (
          <div className="sticky top-0 z-10 bg-surface pt-1.5 pb-1">
            <SearchBox />
          </div>
        )}
        <Card title="Актуальное" more={{ to: '/explore' }}>
          <Trends />
        </Card>
        <Card title="Кого читать" more={{ to: '/explore?tab=recs' }}>
          <WhoToFollow />
        </Card>
      </div>
    </aside>
  )
}
