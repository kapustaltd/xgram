import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Plus } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Composer } from '../components/Composer'
import { FeedSettings } from '../components/FeedSettings'
import { Logo } from '../components/Logo'
import { PageHeader, Tabs } from '../components/PageHeader'
import { PostList, PostSkeleton } from '../components/PostCard'
import { Button, EmptyState, ErrorState, IconButton } from '../components/ui'
import { feedPeers, feedPosts, loadFeed, loadFeeds, saveFeeds, type CustomFeed } from '../lib/feed'
import { useAsync } from '../lib/useAsync'
import { useApi, useApp } from '../store'
import type { Post } from '../tg/types'
import { engagementScore } from '../tg/util'

/** 'for-you' | 'following' | `feed:${CustomFeed.id}` */
type Tab = string

const feedTab = (f: CustomFeed) => `feed:${f.id}`

export function Home() {
  const api = useApi()
  const me = useApp((s) => s.me)
  const [feeds, setFeeds] = useState(loadFeeds)
  const [settings, setSettings] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(() => sessionStorage.getItem('xg:home-tab') || 'for-you')
  const custom = feeds.find((f) => feedTab(f) === tab)
  const current = custom ? tab : tab === 'following' ? 'following' : 'for-you'
  /** Chats the current custom tab reads; null — the main channel feed. */
  const scope = useRef<Set<string> | null>(null)

  async function fetchFeed(force = false): Promise<Post[]> {
    if (!custom) {
      scope.current = null
      return loadFeed(api, force)
    }
    const [dialogs, folders] = await Promise.all([api.getDialogs(), api.getFolders().catch(() => [])])
    const peers = feedPeers(custom, dialogs, folders)
    scope.current = new Set(peers)
    return peers.length ? loadFeed(api, force, peers) : []
  }

  const { data, error, loading, reload, setData } = useAsync(() => fetchFeed(), [api, custom && JSON.stringify(custom)])
  const [fresh, setFresh] = useState<Post[]>([])

  useEffect(() => {
    sessionStorage.setItem('xg:home-tab', current)
    setFresh([])
  }, [current])

  // New posts arrive as a "Показать N постов" pill, like X.
  useEffect(
    () =>
      api.subscribe((ev) => {
        if (ev.type !== 'message' || ev.post.service) return
        const inScope = scope.current ? scope.current.has(ev.post.peerId) : api.peerSync(ev.post.peerId)?.kind === 'channel'
        if (!inScope) return
        setFresh((f) => (f.some((p) => p.id === ev.post.id && p.peerId === ev.post.peerId) ? f : [ev.post, ...f]))
      }),
    [api],
  )

  const posts = useMemo(() => {
    const list = data ?? []
    if (custom) return feedPosts(custom, list)
    if (current === 'following') return [...list].sort((a, b) => b.date - a.date)
    return [...list].sort((a, b) => engagementScore(b) - engagementScore(a))
  }, [data, current, custom])

  function changeFeeds(next: CustomFeed[], select?: string) {
    setFeeds(next)
    saveFeeds(next)
    if (select) setTab(`feed:${select}`)
  }

  function onTab(id: Tab) {
    // A second click on an active custom tab opens its settings.
    if (id === current && custom) setSettings(custom.id)
    else setTab(id)
  }

  function showFresh() {
    setData([...fresh, ...(data ?? [])])
    setFresh([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <PageHeader className="border-b-divider">
        <div className="flex h-[53px] items-center justify-between px-4 sm:hidden">
          <Avatar peer={me ?? undefined} size={32} />
          <Logo className="size-7" />
          <span className="w-8" />
        </div>
        <div className="flex items-center">
          <div className="min-w-0 flex-1">
            <Tabs
              value={current}
              onChange={onTab}
              tabs={[{ id: 'for-you', label: 'Для вас' }, { id: 'following', label: 'Подписки' }, ...feeds.map((f) => ({ id: feedTab(f), label: f.title }))]}
            />
          </div>
          <IconButton label="Настроить ленты" className="mx-2" onClick={() => setSettings(feeds.length ? 'list' : 'new')}>
            <Plus />
          </IconButton>
        </div>
      </PageHeader>

      {fresh.length > 0 && (
        <div className="pointer-events-none sticky top-[60px] z-10 flex justify-center sm:top-[64px]">
          <button type="button" onClick={showFresh} className="x-button pointer-events-auto h-9 gap-2 bg-btn-brand px-4 text-white shadow-popup hover:bg-btn-brand-hover">
            <ArrowUp className="size-4" /> Показать {fresh.length} {fresh.length === 1 ? 'пост' : 'постов'}
          </button>
        </div>
      )}

      <div className="hidden sm:block">
        <Composer inline placeholder="Что происходит?" onSent={() => fetchFeed(true).then(setData)} />
      </div>

      {loading && !data && Array.from({ length: 6 }, (_, i) => <PostSkeleton key={i} />)}
      {error && <ErrorState error={error} onRetry={() => fetchFeed(true).then(setData, reload)} />}
      {data && (
        <PostList
          posts={posts}
          empty={
            custom ? (
              <EmptyState
                title="В этой ленте пока пусто"
                text={scope.current?.size ? 'Под фильтры ленты не подошёл ни один свежий пост.' : 'Выберите папки, каналы или группы, из которых собирать посты.'}
                action={<Button onClick={() => setSettings(custom.id)}>Настроить ленту</Button>}
              />
            ) : (
              <EmptyState title="Добро пожаловать в Xgram!" text="Здесь появятся посты из каналов, на которые вы подписаны. Найдите интересные каналы во вкладке «Поиск»." />
            )
          }
        />
      )}
      {settings && <FeedSettings key={settings} feeds={feeds} edit={settings} onChange={changeFeeds} onClose={() => setSettings(null)} />}
    </>
  )
}
