import { useState } from 'react'
import { PageHeader, Tabs } from '../components/PageHeader'
import { PeerRow } from '../components/RightColumn'
import { EmptyState, ErrorState, Spinner } from '../components/ui'
import { listTime } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useApi } from '../store'

type Tab = 'channels' | 'groups'

/** Subscriptions — X "Lists"-style index of joined channels and groups. */
export function Channels() {
  const api = useApi()
  const [tab, setTab] = useState<Tab>('channels')
  const { data, error, loading, reload } = useAsync(() => api.getDialogs(), [api])
  const list = (data ?? []).filter((d) => (tab === 'channels' ? d.peer.kind === 'channel' : d.peer.kind === 'group'))
  return (
    <>
      <PageHeader back title="Подписки" subtitle={data ? `${list.length}` : undefined}>
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'channels', label: 'Каналы' },
            { id: 'groups', label: 'Группы' },
          ]}
        />
      </PageHeader>
      {loading && !data && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && !list.length && <EmptyState title={tab === 'channels' ? 'Вы не подписаны на каналы' : 'Вы не состоите в группах'} />}
      {list.map((d) => (
        <PeerRow
          key={d.peer.id}
          peer={d.peer}
          sub={d.last ? `${listTime(d.last.date)} · ${d.last.text.slice(0, 80) || 'медиа'}` : undefined}
          right={d.unread ? <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-subtext3 font-bold text-white">{d.unread}</span> : <span />}
        />
      ))}
    </>
  )
}
