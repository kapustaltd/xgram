import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { cn } from '../lib/cn'
import { useApi, useApp } from '../store'
import { ComposeModal } from './Composer'
import { RightColumn } from './RightColumn'
import { ComposeFab, Sidebar, TabBar } from './Sidebar'
import { Toast } from './ui'

/** Keeps sidebar/tab-bar unread badges in sync with dialogs + live updates. */
function useBadgeSync() {
  const api = useApi()
  const setBadges = useApp((s) => s.setBadges)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () =>
      api
        .getDialogs()
        .then((ds) => {
          const chats = ds.filter((d) => d.peer.kind !== 'channel' && !d.muted && d.unread > 0).length
          const mentions = ds.reduce((s, d) => s + d.unreadMentions, 0)
          setBadges({ messages: chats, notifications: mentions })
          document.title = chats ? `(${chats}) Xgram` : 'Xgram'
        })
        .catch(() => {})
    refresh()
    const off = api.subscribe(() => {
      clearTimeout(timer)
      timer = setTimeout(refresh, 600)
    })
    return () => {
      off()
      clearTimeout(timer)
    }
  }, [api, setBadges])
}

export function Layout() {
  useBadgeSync()
  const { pathname } = useLocation()
  const wide = pathname.startsWith('/messages')
  const noSearch = pathname.startsWith('/explore')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1265px] justify-center sm:justify-start">
      <Sidebar />
      <main className="flex min-w-0 flex-1">
        <div
          className={cn(
            'min-h-dvh w-full border-divider pb-14 sm:border-x sm:pb-0',
            wide ? 'max-w-[990px] lg:min-w-[600px]' : 'max-w-[600px] min-w-0',
          )}
        >
          <Outlet />
        </div>
        {!wide && <RightColumn search={!noSearch} />}
      </main>
      <TabBar />
      {!wide && <ComposeFab />}
      <ComposeModal />
      <Toast />
    </div>
  )
}
