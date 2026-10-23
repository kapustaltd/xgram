import { useSearchParams } from 'react-router-dom'
import { PageHeader, Tabs } from '../components/PageHeader'
import { PostList, PostSkeleton } from '../components/PostCard'
import { PeerRow, SearchBox } from '../components/RightColumn'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { loadFeed } from '../lib/feed'
import { useAsync } from '../lib/useAsync'
import { useApi } from '../store'
import { engagementScore } from '../tg/util'

type Tab = 'top' | 'people' | 'posts' | 'recs'

function Results({ q, tab }: { q: string; tab: Tab }) {
  const api = useApi()
  const { data, error, loading, reload } = useAsync(() => api.search(q), [api, q])
  if (loading) return <>{Array.from({ length: 4 }, (_, i) => <PostSkeleton key={i} />)}</>
  if (error) return <ErrorState error={error} onRetry={reload} />
  if (!data) return null
  const noResults = <EmptyState title={`Нет результатов по запросу «${q}»`} text="Попробуйте другой запрос или проверьте написание." />
  if (tab === 'people') return data.peers.length ? <>{data.peers.map((p) => <PeerRow key={p.id} peer={p} />)}</> : noResults
  if (tab === 'posts') return <PostList posts={data.posts} empty={noResults} />
  if (!data.peers.length && !data.posts.length) return noResults
  return (
    <>
      {data.peers.length > 0 && (
        <div className="border-b border-divider">
          <h2 className="px-4 pt-3 pb-1 text-headline1 font-extrabold">Каналы и люди</h2>
          {data.peers.slice(0, 3).map((p) => (
            <PeerRow key={p.id} peer={p} />
          ))}
        </div>
      )}
      <PostList posts={data.posts} />
    </>
  )
}

function Discover({ tab }: { tab: Tab }) {
  const api = useApi()
  const feed = useAsync(() => loadFeed(api), [api])
  const recs = useAsync(() => api.getRecommendations(), [api])
  if (tab === 'recs') {
    if (recs.loading) return <Spinner />
    return recs.data?.length ? <>{recs.data.map((p) => <PeerRow key={p.id} peer={p} />)}</> : <EmptyState title="Рекомендаций пока нет" />
  }
  if (feed.loading) return <>{Array.from({ length: 4 }, (_, i) => <PostSkeleton key={i} />)}</>
  if (feed.error) return <ErrorState error={feed.error} onRetry={feed.reload} />
  const top = [...(feed.data ?? [])].sort((a, b) => engagementScore(b) - engagementScore(a)).slice(0, 20)
  return (
    <>
      {!!recs.data?.length && (
        <div className="border-b border-divider">
          <h2 className="px-4 pt-3 pb-1 text-headline1 font-extrabold">Кого читать</h2>
          {recs.data.slice(0, 3).map((p) => (
            <PeerRow key={p.id} peer={p} />
          ))}
        </div>
      )}
      <h2 className="border-b border-divider px-4 py-3 text-headline1 font-extrabold">Популярное в ваших каналах</h2>
      <PostList posts={top} empty={<EmptyState title="Пока пусто" />} />
    </>
  )
}

export function Explore() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tab = (params.get('tab') as Tab) || 'top'
  const setTab = (t: Tab) => setParams((p) => (p.set('tab', t), p))
  return (
    <>
      <PageHeader>
        <div className="px-4 pt-1.5 pb-1">
          <SearchBox key={q} initial={q} autoFocus={!q} onSubmit={(v) => setParams({ q: v })} />
        </div>
        {q ? (
          <Tabs
            value={tab === 'recs' ? 'top' : tab}
            onChange={setTab}
            tabs={[
              { id: 'top', label: 'Лучшее' },
              { id: 'people', label: 'Каналы и люди' },
              { id: 'posts', label: 'Посты' },
            ]}
          />
        ) : (
          <Tabs
            value={tab === 'recs' ? 'recs' : 'top'}
            onChange={setTab}
            tabs={[
              { id: 'top', label: 'Для вас' },
              { id: 'recs', label: 'Рекомендации' },
            ]}
          />
        )}
      </PageHeader>
      {q ? <Results q={q} tab={tab} /> : <Discover tab={tab} />}
    </>
  )
}
