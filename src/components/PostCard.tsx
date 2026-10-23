import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Bookmark, Heart, Link2, MessageCircle, MoreHorizontal, Repeat2, Share, Forward, Users } from 'lucide-react'
import { cn } from '../lib/cn'
import { compact, fullDate, shortCount, timeAgo } from '../lib/format'
import { errorText, useApi, useApp } from '../store'
import type { Peer, Post, Reaction } from '../tg/types'
import { Avatar } from './Avatar'
import { MediaBlock } from './Media'
import { PeerName, peerPath } from './PeerName'
import { PostText } from './PostText'
import { MenuItem, Popover } from './ui'

const LIKE = '❤'

export const postPath = (p: Pick<Post, 'peerId' | 'id'>) => `/post/${p.peerId}/${p.id}`

/** Who to show as the author: channel posts → channel, group messages → sender. */
export function useAuthor(post: Post): { author?: Peer; chat?: Peer } {
  const api = useApi()
  const chat = api.peerSync(post.peerId)
  if (!chat || chat.kind === 'channel') return { author: chat }
  const sender = post.senderId ? api.peerSync(post.senderId) : undefined
  return { author: sender ?? chat, chat: chat.kind === 'group' ? chat : undefined }
}

function EngagementButton({
  icon,
  count,
  label,
  hover,
  active,
  onClick,
  className,
}: {
  icon: ReactNode
  count?: number
  label: string
  hover: 'brand' | 'green' | 'pink'
  active?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
}) {
  const tone = {
    brand: ['hover:text-brand', 'bg-brand/10', 'text-brand'],
    green: ['hover:text-x-green', 'bg-x-green/10', 'text-x-green'],
    pink: ['hover:text-x-pink', 'bg-x-pink/10', 'text-x-pink'],
  }[hover]
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className={cn('group x-engagement-button flex items-center transition-colors', active ? tone[2] : 'text-secondary', tone[0], className)}
    >
      <span className="x-engagement-pill h-9 px-2.5 [&>svg]:size-[18.75px]">
        <span className={cn('x-pill-bg', tone[1])} />
        {icon}
        {!!count && <span className="inline-flex ps-1 text-subtext2 tabular-nums">{shortCount(count)}</span>}
      </span>
    </button>
  )
}

export function EngagementBar({ post, onReply, big }: { post: Post; onReply?: () => void; big?: boolean }) {
  const api = useApi()
  const toast = useApp((s) => s.showToast)
  const [reactions, setReactions] = useState<Reaction[]>(post.reactions ?? [])
  const [shareOpen, setShareOpen] = useState(false)
  const [repostOpen, setRepostOpen] = useState(false)
  const total = reactions.reduce((s, r) => s + r.count, 0)
  const mine = reactions.find((r) => r.chosen)
  const link = api.postLink(post)

  async function react(emoji: string | null) {
    const prev = reactions
    const next = prev.map((r) => (r.chosen ? { ...r, chosen: false, count: r.count - 1 } : r)).filter((r) => r.count > 0)
    if (emoji) {
      const hit = next.find((r) => r.emoji === emoji)
      if (hit) Object.assign(hit, { chosen: true, count: hit.count + 1 })
      else next.push({ emoji, count: 1, chosen: true })
    }
    setReactions(next)
    try {
      await api.sendReaction(post.peerId, post.id, emoji)
    } catch (e) {
      setReactions(prev)
      toast(errorText(e))
    }
  }

  const likeEmoji = reactions.find((r) => r.emoji.startsWith(LIKE))?.emoji ?? '❤️'

  return (
    <div className="flex flex-col gap-2">
      {reactions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...reactions]
            .sort((a, b) => b.count - a.count)
            .slice(0, big ? 12 : 5)
            .map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  react(r.chosen ? null : r.emoji)
                }}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-subtext2 tabular-nums transition-colors',
                  r.chosen ? 'border-brand bg-brand/10 text-brand' : 'border-divider text-secondary hover:bg-hover-subtle',
                )}
              >
                <span className="text-[15px] leading-none">{r.emoji}</span>
                {compact(r.count)}
              </button>
            ))}
        </div>
      )}
      <div className={cn('@container -mx-2 flex w-[calc(100%+16px)] items-center justify-between overflow-visible', big ? 'h-12' : 'h-5')}>
        <div className="min-w-0 flex-1">
          <EngagementButton icon={<MessageCircle />} count={post.replies} label="Комментарии" hover="brand" onClick={onReply} />
        </div>
        <div className="relative min-w-0 flex-1">
          <EngagementButton icon={<Repeat2 />} count={post.forwards} label="Переслать" hover="green" onClick={() => setRepostOpen(true)} />
          <Popover open={repostOpen} onClose={() => setRepostOpen(false)} className="top-8 left-0 w-64">
            <MenuItem
              icon={<Forward />}
              onClick={async () => {
                setRepostOpen(false)
                try {
                  await api.bookmark(post.peerId, post.id)
                  toast('Переслано в Избранное')
                } catch (e) {
                  toast(errorText(e))
                }
              }}
            >
              Переслать в Избранное
            </MenuItem>
            {link && (
              <MenuItem
                icon={<Link2 />}
                onClick={() => {
                  setRepostOpen(false)
                  navigator.clipboard.writeText(link)
                  toast('Ссылка скопирована')
                }}
              >
                Скопировать ссылку
              </MenuItem>
            )}
          </Popover>
        </div>
        <div className="min-w-0 flex-1">
          <EngagementButton
            icon={<Heart className={cn(mine && 'fill-current')} />}
            count={total}
            label={mine ? 'Убрать реакцию' : 'Нравится'}
            hover="pink"
            active={!!mine}
            onClick={() => react(mine ? null : likeEmoji)}
          />
        </div>
        <div className="min-w-0 flex-1 @max-[420px]:hidden">
          <EngagementButton icon={<BarChart2 />} count={post.views} label="Просмотры" hover="brand" />
        </div>
        <div className="relative flex shrink-0 items-center">
          <EngagementButton
            className="@max-[480px]:hidden"
            icon={<Bookmark />}
            label="В закладки"
            hover="brand"
            onClick={async () => {
              try {
                await api.bookmark(post.peerId, post.id)
                toast('Добавлено в закладки')
              } catch (e) {
                toast(errorText(e))
              }
            }}
          />
          <EngagementButton icon={<Share />} label="Поделиться" hover="brand" onClick={() => setShareOpen(true)} />
          <Popover open={shareOpen} onClose={() => setShareOpen(false)} className="top-8 right-0 w-64">
            <MenuItem
              icon={<Link2 />}
              onClick={() => {
                setShareOpen(false)
                if (link) {
                  navigator.clipboard.writeText(link)
                  toast('Ссылка скопирована')
                } else toast('У этого сообщения нет публичной ссылки')
              }}
            >
              Скопировать ссылку
            </MenuItem>
          </Popover>
        </div>
      </div>
    </div>
  )
}

export function PostCard({ post, context, showMore = true, bare }: { post: Post; context?: ReactNode; showMore?: boolean; /** hide the chat/forward context row */ bare?: boolean }) {
  const navigate = useNavigate()
  const api = useApi()
  const openCompose = useApp((s) => s.openCompose)
  const { author, chat } = useAuthor(post)
  const [menu, setMenu] = useState(false)
  const open = () => navigate(postPath(post))
  const channel = api.peerSync(post.peerId)

  return (
    <article
      onClick={open}
      className="flex cursor-pointer flex-col gap-1 border-b border-divider px-4 pt-3 pb-2 transition-colors hover:bg-hover-faint"
    >
      {!bare && (context || post.forwardedFrom || chat) && (
        <div className="flex items-center gap-2 text-subtext1 font-bold text-secondary">
          <span className="flex w-10 shrink-0 justify-end">{post.forwardedFrom ? <Repeat2 className="size-4" /> : <Users className="size-4" />}</span>
          <span className="truncate">{context ?? (post.forwardedFrom ? `Переслано из ${post.forwardedFrom}` : chat?.title)}</span>
        </div>
      )}
      <div className="flex gap-2">
        <div className="relative w-10 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (author) navigate(peerPath(author))
            }}
          >
            <Avatar peer={author} />
          </button>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="x-middot-group text-body text-secondary">
                {author ? <PeerName peer={author} /> : <span className="font-bold text-primary">…</span>}
                <span className="shrink-0 whitespace-nowrap hover:underline" title={fullDate(post.date)}>
                  {timeAgo(post.date)}
                </span>
              </div>
              <div className="relative -my-2 -me-[5px] shrink-0">
                <button
                  type="button"
                  aria-label="Ещё"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenu(true)
                  }}
                  className="x-button group size-8 text-secondary hover:bg-brand/10 hover:text-brand"
                >
                  <MoreHorizontal className="size-[18.75px]" />
                </button>
                <Popover open={menu} onClose={() => setMenu(false)} className="top-0 right-0 w-72" >
                  {channel && (
                    <MenuItem icon={<Users />} onClick={() => navigate(peerPath(channel))}>
                      Открыть {channel.kind === 'channel' ? 'канал' : 'чат'}
                    </MenuItem>
                  )}
                  {channel && channel.kind !== 'channel' && (
                    <MenuItem icon={<MessageCircle />} onClick={() => navigate(`/messages/${channel.id}`)}>
                      Перейти к сообщению в чате
                    </MenuItem>
                  )}
                  {api.postLink(post) && (
                    <MenuItem icon={<Link2 />} onClick={() => window.open(api.postLink(post)!, '_blank')}>
                      Открыть в Telegram
                    </MenuItem>
                  )}
                </Popover>
              </div>
            </div>
            <PostText text={post.text} entities={post.entities} clamp={showMore ? 560 : undefined} onMore={open} />
          </div>
          <MediaBlock media={post.media} link={api.postLink(post)} />
          <EngagementBar
            post={post}
            onReply={() =>
              channel?.kind === 'channel'
                ? navigate(postPath(post))
                : openCompose({ peerId: post.peerId, replyTo: post.id, title: channel?.title })
            }
          />
        </div>
      </div>
    </article>
  )
}

export function PostSkeleton() {
  return (
    <div className="flex gap-2 border-b border-divider px-4 py-3">
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-hover-subtle" />
      <div className="flex flex-1 flex-col gap-2 pt-1">
        <div className="h-3.5 w-1/3 animate-pulse rounded-full bg-hover-subtle" />
        <div className="h-3.5 w-11/12 animate-pulse rounded-full bg-hover-subtle" />
        <div className="h-3.5 w-3/4 animate-pulse rounded-full bg-hover-subtle" />
      </div>
    </div>
  )
}

export function PostList({ posts, empty }: { posts: Post[]; empty?: ReactNode }) {
  if (!posts.length) return <>{empty}</>
  return (
    <>
      {posts.map((p) => (
        <PostCard key={`${p.peerId}:${p.id}`} post={p} />
      ))}
    </>
  )
}
