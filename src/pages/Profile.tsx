import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AtSign, Bot, Link2, Mail, Phone, Users } from 'lucide-react'
import { Avatar, gradientFor, useAvatarUrl } from '../components/Avatar'
import { PageHeader, Tabs } from '../components/PageHeader'
import { PostCard, PostSkeleton } from '../components/PostCard'
import { PeerName } from '../components/PeerName'
import { FollowButton } from '../components/RightColumn'
import { GiftsGrid } from '../components/Gifts'
import { EditProfileModal } from '../components/EditProfile'
import { Button, EmptyState, ErrorState, IconButton, Spinner } from '../components/ui'
import { compact, fullNumber, pluralRu } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useApi, useApp } from '../store'
import type { Peer, Post } from '../tg/types'
import { groupAlbums } from '../tg/util'

function Banner({ peer }: { peer: Peer }) {
  const src = useAvatarUrl(peer.id)
  const [a, b] = gradientFor(peer.id)
  // Telegram has no profile banners: use a blurred, darkened avatar (or its placeholder gradient).
  return (
    <div className="relative aspect-[3/1] overflow-hidden bg-surface-3">
      {src ? (
        <img src={src} alt="" className="size-full scale-125 object-cover blur-2xl brightness-75" />
      ) : (
        <div className="size-full opacity-80" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
      )}
    </div>
  )
}

function useHistory(peerId: string | undefined, enabled: boolean) {
  const api = useApi()
  const [posts, setPosts] = useState<Post[]>([])
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const raw = useRef<Post[]>([])

  const more = useCallback(async () => {
    if (!peerId || loading || done) return
    setLoading(true)
    try {
      const offsetId = raw.current.at(-1)?.id
      const page = await api.getHistory(peerId, { limit: 30, offsetId })
      raw.current = [...raw.current, ...page]
      setPosts(groupAlbums(raw.current.filter((p) => !p.service)))
      if (page.length < 30 || api.mode === 'demo') setDone(true)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [api, peerId, loading, done])

  useEffect(() => {
    raw.current = []
    setPosts([])
    setDone(false)
    setError(null)
  }, [peerId])

  useEffect(() => {
    if (enabled && peerId && !raw.current.length && !done && !loading && !error) more()
  }, [enabled, peerId, more, done, loading, error])

  return { posts, more, done, loading, error }
}

function InfiniteSentinel({ onVisible }: { onVisible: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && onVisible(), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [onVisible])
  return <div ref={ref} className="h-px" />
}

type Tab = 'posts' | 'media' | 'gifts'

export function Profile() {
  const params = useParams()
  const api = useApi()
  const me = useApp((s) => s.me)!
  const navigate = useNavigate()
  const handle = params.handle
  const peerKey = params.peerId ?? (handle ? (handle.startsWith('@') ? handle : null) : me.id)
  const { data: peer, error, loading, reload } = useAsync(
    () => (peerKey ? api.getPeer(peerKey, true) : Promise.reject(new Error('Страница не найдена'))),
    [api, peerKey],
  )
  const [tabChoice, setTab] = useState<{ peer?: string; tab: Tab }>({ tab: 'posts' })
  const [editing, setEditing] = useState(false)
  const isMe = peer?.isSelf
  const isChatLike = peer && (peer.kind === 'channel' || peer.kind === 'group' || isMe)
  // Star gifts live on users' and channels' profiles.
  const hasGifts = peer && (peer.kind === 'user' || peer.kind === 'channel')
  // A choice made on another profile doesn't carry over; people without a feed open on gifts.
  const tab: Tab = tabChoice.peer === peer?.id ? tabChoice.tab : isChatLike ? 'posts' : 'gifts'
  const history = useHistory(peer?.id, !!isChatLike && tab !== 'gifts')

  if (loading && !peer) return <><PageHeader back title="Профиль" /><Spinner /></>
  if (error || !peer) return <><PageHeader back title="Профиль" /><ErrorState error={error ?? new Error('Не найдено')} onRetry={reload} /></>

  const visible = tab === 'media' ? history.posts.filter((p) => p.media.some((m) => m.kind === 'photo' || m.kind === 'video' || m.kind === 'gif')) : history.posts
  const membersLabel =
    peer.members != null
      ? `${peer.kind === 'channel' ? pluralRu(peer.members, 'подписчик', 'подписчика', 'подписчиков') : pluralRu(peer.members, 'участник', 'участника', 'участников')}`
      : ''

  return (
    <>
      <PageHeader
        back
        title={<PeerName peer={peer} link={false} handle={false} nameClass="text-headline1" />}
        subtitle={peer.members ? `${fullNumber(peer.members)} ${membersLabel}` : isMe ? 'Избранное' : peer.kind === 'bot' ? 'бот' : undefined}
      />
      <Banner peer={peer} />
      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        <div className="flex items-start justify-between">
          <div className="relative z-[1] -mt-[15%] sm:-mt-[78px]">
            <Avatar peer={peer} size={134} className="border-4 border-surface max-sm:size-[86px]!" />
          </div>
          <div className="flex items-center gap-2">
            {isMe ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Изменить профиль
              </Button>
            ) : (
              <>
                {(peer.kind === 'user' || peer.kind === 'bot' || peer.kind === 'group') && (
                  <IconButton label="Сообщение" className="border border-normal" onClick={() => navigate(`/messages/${peer.id}`)}>
                    <Mail />
                  </IconButton>
                )}
                {peer.kind === 'user' || peer.kind === 'bot' ? (
                  <Button onClick={() => navigate(`/messages/${peer.id}`)}>Написать</Button>
                ) : (
                  <FollowButton peer={peer} className="h-9 text-body" />
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col">
          <PeerName peer={peer} link={false} handle={false} nameClass="text-headline1 font-extrabold" statusSize={24} animateStatus />
          {peer.username && <span className="text-body text-secondary">@{peer.username}</span>}
        </div>
        {peer.about && <p className="text-body whitespace-pre-wrap">{peer.about}</p>}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-body text-secondary">
          {peer.kind === 'bot' && (
            <span className="flex items-center gap-1">
              <Bot className="size-[18px]" /> Бот
            </span>
          )}
          {peer.username && (
            <a href={`https://t.me/${peer.username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
              <Link2 className="size-[18px]" /> <span className="text-brand hover:underline">t.me/{peer.username}</span>
            </a>
          )}
          {isMe && peer.phone && (
            <span className="flex items-center gap-1">
              <Phone className="size-[18px]" /> {peer.phone.startsWith('+') ? peer.phone : `+${peer.phone}`}
            </span>
          )}
          {peer.kind === 'group' && (
            <span className="flex items-center gap-1">
              <Users className="size-[18px]" /> Группа
            </span>
          )}
          {!peer.username && !isMe && peer.kind !== 'group' && (
            <span className="flex items-center gap-1">
              <AtSign className="size-[18px]" /> без публичного имени
            </span>
          )}
        </div>
        {peer.members != null && (
          <div className="text-body text-secondary">
            <b className="text-primary">{compact(peer.members) || 0}</b> {membersLabel}
          </div>
        )}
      </div>

      {isChatLike || hasGifts ? (
        <>
          <div className="border-b border-divider">
            <Tabs
              value={tab}
              onChange={(t) => setTab({ peer: peer.id, tab: t })}
              tabs={[
                ...(isChatLike
                  ? [
                      { id: 'posts' as const, label: isMe ? 'Избранное' : peer.kind === 'group' ? 'Сообщения' : 'Посты' },
                      { id: 'media' as const, label: 'Медиа' },
                    ]
                  : []),
                ...(hasGifts ? [{ id: 'gifts' as const, label: 'Подарки' }] : []),
              ]}
            />
          </div>
          {tab === 'gifts' ? (
            <GiftsGrid key={peer.id} peerId={peer.id} />
          ) : (
            <>
              {visible.map((p) => (
                <PostCard key={`${p.peerId}:${p.id}`} post={p} />
              ))}
              {history.loading && (history.posts.length ? <Spinner /> : Array.from({ length: 4 }, (_, i) => <PostSkeleton key={i} />))}
              {history.error && <ErrorState error={history.error} />}
              {!history.loading && !history.done && history.posts.length > 0 && <InfiniteSentinel onVisible={history.more} />}
              {!history.loading && history.done && visible.length === 0 && (
                <EmptyState title={tab === 'media' ? 'Пока нет медиа' : 'Пока нет постов'} text="Когда здесь что-то появится, вы увидите это в этой ленте." />
              )}
            </>
          )}
        </>
      ) : (
        <div className="border-t border-divider">
          <EmptyState
            title={`Это ${peer.kind === 'bot' ? 'бот' : 'личный профиль'}`}
            text={`Переписка с ${peer.title} доступна в разделе «Сообщения».`}
            action={<Button size="lg" onClick={() => navigate(`/messages/${peer.id}`)}>Открыть чат</Button>}
          />
        </div>
      )}
      {isMe && <EditProfileModal open={editing} onClose={() => setEditing(false)} onSaved={reload} />}
    </>
  )
}
