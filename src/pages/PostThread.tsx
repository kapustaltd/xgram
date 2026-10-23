import { useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Composer } from '../components/Composer'
import { MediaBlock } from '../components/Media'
import { PageHeader } from '../components/PageHeader'
import { EngagementBar, PostCard, useAuthor } from '../components/PostCard'
import { PeerName, peerPath } from '../components/PeerName'
import { PostText } from '../components/PostText'
import { FollowButton } from '../components/RightColumn'
import { ErrorState, Spinner } from '../components/ui'
import { compact, fullDate } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useApi } from '../store'
import type { Post } from '../tg/types'

function MainPost({ post }: { post: Post }) {
  const api = useApi()
  const navigate = useNavigate()
  const { author, chat } = useAuthor(post)
  return (
    <article className="flex flex-col gap-3 px-4 pt-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => author && navigate(peerPath(author))}>
          <Avatar peer={author} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col text-body">
          {author && <PeerName peer={author} handle={false} />}
          <span className="truncate text-secondary">{author?.username ? `@${author.username}` : (chat?.title ?? '')}</span>
        </div>
        {author && author.kind === 'channel' && <FollowButton peer={author} />}
      </div>
      {post.forwardedFrom && <div className="text-subtext1 text-secondary">Переслано из {post.forwardedFrom}</div>}
      <PostText text={post.text} entities={post.entities} className="text-[17px] leading-6" />
      <MediaBlock media={post.media} link={api.postLink(post)} />
      <div className="x-middot-group text-body text-secondary">
        <span className="hover:underline">{fullDate(post.date)}</span>
        {post.views ? (
          <span>
            <b className="text-primary">{compact(post.views)}</b> просмотров
          </span>
        ) : null}
        {post.edited && <span>изменено</span>}
      </div>
      <div className="border-t border-divider pt-1">
        <EngagementBar post={post} big />
      </div>
    </article>
  )
}

export function PostThread() {
  const { peerId = '', msgId = '0' } = useParams()
  const api = useApi()
  const { data, error, loading, reload } = useAsync(() => api.getThread(peerId, Number(msgId)), [api, peerId, msgId])
  const chat = api.peerSync(peerId)
  const canComment = chat?.kind === 'channel' ? data?.root.replies != null : chat?.kind === 'group'

  return (
    <>
      <PageHeader back title="Пост" />
      {loading && !data && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <>
          <MainPost post={data.root} />
          <div className="border-y border-divider">
            {canComment ? (
              <Composer
                target={{ peerId, commentTo: chat?.kind === 'channel' ? data.root.id : undefined, replyTo: chat?.kind === 'group' ? data.root.id : undefined }}
                placeholder="Опубликуйте ответ"
                submitLabel="Ответить"
                onSent={reload}
              />
            ) : (
              <p className="px-4 py-3 text-body text-secondary">Комментарии к этому посту отключены.</p>
            )}
          </div>
          {data.replies.map((p) => (
            <PostCard key={`${p.peerId}:${p.id}`} post={p} showMore={false} bare />
          ))}
          {canComment && data.replies.length === 0 && <p className="px-4 py-8 text-center text-body text-secondary">Комментариев пока нет. Будьте первым!</p>}
        </>
      )}
    </>
  )
}
