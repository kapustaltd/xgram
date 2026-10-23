import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AtSign, Mail, Megaphone, Users } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { PageHeader, Tabs } from '../components/PageHeader'
import { PostList, PostSkeleton } from '../components/PostCard'
import { peerPath } from '../components/PeerName'
import { EmptyState, ErrorState } from '../components/ui'
import { timeAgo, pluralRu } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useApi } from '../store'
import type { Dialog } from '../tg/types'

type Tab = 'all' | 'mentions'

function Row({ d }: { d: Dialog }) {
  const navigate = useNavigate()
  const kind = d.peer.kind
  const Icon = d.unreadMentions ? AtSign : kind === 'channel' ? Megaphone : kind === 'group' ? Users : Mail
  const n = d.unread
  const text =
    kind === 'channel'
      ? `${n} ${pluralRu(n, 'новый пост', 'новых поста', 'новых постов')} в канале`
      : kind === 'group'
        ? d.unreadMentions
          ? 'Вас упомянули в группе'
          : `${n} ${pluralRu(n, 'новое сообщение', 'новых сообщения', 'новых сообщений')} в группе`
        : `отправил(а) вам ${n} ${pluralRu(n, 'сообщение', 'сообщения', 'сообщений')}`
  return (
    <button
      type="button"
      onClick={() => navigate(kind === 'channel' ? peerPath(d.peer) : `/messages/${d.peer.id}`)}
      className="flex w-full gap-3 border-b border-divider px-4 py-3 text-left transition-colors hover:bg-hover-faint"
    >
      <div className="flex w-10 shrink-0 justify-end pt-1">
        <Icon className="size-7 text-brand" strokeWidth={2.2} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Avatar peer={d.peer} size={32} />
        <div className="text-body">
          <b>{d.peer.title}</b> <span className="text-secondary">{text}</span>
          {d.last && <span className="text-secondary"> · {timeAgo(d.last.date)}</span>}
        </div>
        {d.last?.text && <p className="line-clamp-3 text-body text-secondary">{d.last.text}</p>}
      </div>
    </button>
  )
}

export function Notifications() {
  const api = useApi()
  const [tab, setTab] = useState<Tab>('all')
  const dialogs = useAsync(() => api.getDialogs(), [api])
  const mentions = useAsync(() => (tab === 'mentions' ? api.getMentions() : Promise.resolve([])), [api, tab])
  const unread = (dialogs.data ?? []).filter((d) => d.unread > 0 && !d.muted).sort((a, b) => (b.last?.date ?? 0) - (a.last?.date ?? 0))

  return (
    <>
      <PageHeader title="Уведомления">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'all', label: 'Все' },
            { id: 'mentions', label: 'Упоминания' },
          ]}
        />
      </PageHeader>
      {tab === 'all' && (
        <>
          {dialogs.loading && Array.from({ length: 4 }, (_, i) => <PostSkeleton key={i} />)}
          {dialogs.error && <ErrorState error={dialogs.error} onRetry={dialogs.reload} />}
          {dialogs.data && (unread.length ? unread.map((d) => <Row key={d.peer.id} d={d} />) : <EmptyState title="Пока ничего нет" text="Здесь появятся новые сообщения, посты и упоминания." />)}
        </>
      )}
      {tab === 'mentions' && (
        <>
          {mentions.loading && Array.from({ length: 3 }, (_, i) => <PostSkeleton key={i} />)}
          {mentions.error && <ErrorState error={mentions.error} onRetry={mentions.reload} />}
          {mentions.data && <PostList posts={mentions.data} empty={<EmptyState title="Упоминаний нет" text="Когда кто-то упомянет вас в чате, это появится здесь." />} />}
        </>
      )}
    </>
  )
}
