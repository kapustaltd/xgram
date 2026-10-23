import { PageHeader } from '../components/PageHeader'
import { PostList, PostSkeleton } from '../components/PostCard'
import { EmptyState, ErrorState } from '../components/ui'
import { useAsync } from '../lib/useAsync'
import { useApi, useApp } from '../store'

export function Bookmarks() {
  const api = useApi()
  const me = useApp((s) => s.me)!
  const { data, error, loading, reload } = useAsync(() => api.getSaved(), [api])
  return (
    <>
      <PageHeader back title="Закладки" subtitle={me.username ? `@${me.username}` : 'Избранное в Telegram'} />
      {loading && !data && Array.from({ length: 5 }, (_, i) => <PostSkeleton key={i} />)}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <PostList
          posts={data}
          empty={<EmptyState title="Сохраняйте посты на потом" text="Добавляйте посты в закладки, чтобы легко находить их в будущем. Они попадают в «Избранное» Telegram." />}
        />
      )}
    </>
  )
}
