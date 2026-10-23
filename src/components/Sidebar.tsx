import { useState, type ComponentType } from 'react'
import { NavLink, Link, useNavigate } from 'react-router-dom'
import { Bell, Bookmark, Feather, Home, LogOut, Mail, Moon, MoreHorizontal, Search, Sun, User, Users } from 'lucide-react'
import { cn } from '../lib/cn'
import { useApp } from '../store'
import { Avatar } from './Avatar'
import { Logo } from './Logo'
import { PeerName } from './PeerName'
import { MenuItem, Popover } from './ui'

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>

/** Filled envelope for the active "Сообщения" tab: lucide's Mail with fill hides the flap. */
function MailFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="4" width="20" height="16" rx="2.5" fill="currentColor" />
      <path d="m3.5 7 7.4 5.2a1.9 1.9 0 0 0 2.2 0L20.5 7" fill="none" stroke="var(--x-bg-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Filled house for the active "Главная" tab; the door is a cut-out, so it reads on any background. */
function HomeFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M10.9 3.4a1.7 1.7 0 0 1 2.2 0l7.3 6.3c.4.3.6.8.6 1.3v8.7c0 .9-.7 1.6-1.6 1.6h-4.2v-5.6c0-.6-.5-1.1-1.1-1.1h-4.2c-.6 0-1.1.5-1.1 1.1v5.6H4.6c-.9 0-1.6-.7-1.6-1.6V11c0-.5.2-1 .6-1.3z"
        fill="currentColor"
      />
    </svg>
  )
}

function NavIcon({ icon: Icon, active, fill, activeIcon: ActiveIcon }: { icon: Icon; active: boolean; fill?: boolean; activeIcon?: Icon }) {
  if (active && ActiveIcon) return <ActiveIcon className="size-[26px]" />
  return <Icon className={cn('size-[26px]', active && fill && 'fill-current')} strokeWidth={active ? 2.4 : 1.8} />
}

export const NAV: { to: string; label: string; icon: Icon; badge?: 'messages' | 'notifications'; fill?: boolean; activeIcon?: Icon }[] = [
  { to: '/home', label: 'Главная', icon: Home, activeIcon: HomeFilled },
  { to: '/explore', label: 'Поиск', icon: Search },
  { to: '/notifications', label: 'Уведомления', icon: Bell, badge: 'notifications', fill: true },
  { to: '/messages', label: 'Сообщения', icon: Mail, badge: 'messages', activeIcon: MailFilled },
  { to: '/channels', label: 'Каналы', icon: Users, fill: true },
  { to: '/bookmarks', label: 'Закладки', icon: Bookmark, fill: true },
  { to: '/profile', label: 'Профиль', icon: User, fill: true },
]

export function Badge({ n, className }: { n: number; className?: string }) {
  if (!n) return null
  return (
    <span
      className={cn(
        'absolute -top-1.5 -end-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-surface bg-brand px-1 text-[11px] leading-none font-bold text-white',
        className,
      )}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

function ThemeItems() {
  const { theme, setTheme } = useApp()
  return (
    <MenuItem icon={theme === 'dark' ? <Sun /> : <Moon />} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    </MenuItem>
  )
}

export function Sidebar() {
  const { me, badges, openCompose, logout, api } = useApp()
  const [more, setMore] = useState(false)
  const [account, setAccount] = useState(false)
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col items-center justify-between overflow-y-auto px-1 sm:flex xl:w-[256px] xl:items-stretch xl:px-2">
      <div className="flex flex-col items-center xl:items-start">
        <Link to="/home" aria-label="Xgram" className="x-button my-0.5 size-[52px] text-primary hover:bg-btn-ghost-hover">
          <Logo className="size-[30px]" />
        </Link>
        <nav className="flex flex-col items-center xl:items-start">
          {NAV.map(({ to, label, icon, badge, fill, activeIcon }) => (
            <NavLink key={to} to={to} className="group py-0.5 outline-none" aria-label={label}>
              {({ isActive }) => (
                <span className="flex items-center gap-5 rounded-full p-3 transition-colors group-hover:bg-btn-ghost-hover group-focus-visible:outline-2 group-focus-visible:outline-brand xl:pe-6">
                  <span className="relative">
                    <NavIcon icon={icon} active={isActive} fill={fill} activeIcon={activeIcon} />
                    {badge && <Badge n={badges[badge]} />}
                  </span>
                  <span className={cn('hidden text-[20px] leading-6 xl:inline', isActive ? 'font-bold' : 'font-normal')}>{label}</span>
                </span>
              )}
            </NavLink>
          ))}
          <div className="relative py-0.5">
            <button type="button" onClick={() => setMore(true)} className="group outline-none" aria-label="Ещё">
              <span className="flex items-center gap-5 rounded-full p-3 transition-colors group-hover:bg-btn-ghost-hover xl:pe-6">
                <MoreHorizontal className="size-[26px] rounded-full border-2 border-current p-0.5" strokeWidth={2.4} />
                <span className="hidden text-[20px] leading-6 xl:inline">Ещё</span>
              </span>
            </button>
            <Popover open={more} onClose={() => setMore(false)} className="bottom-0 left-0 w-72">
              <ThemeItems />
              <MenuItem icon={<Users />} onClick={() => navigate('/channels')}>
                Мои каналы
              </MenuItem>
              <div className="px-4 py-2 text-subtext2 text-secondary">Режим: {api?.mode === 'demo' ? 'демо (локальные данные)' : 'Telegram MTProto'}</div>
            </Popover>
          </div>
        </nav>
        <button
          type="button"
          onClick={() => openCompose()}
          className="x-button mt-4 size-[52px] bg-btn-primary text-inverted hover:bg-btn-primary-hover xl:h-[52px] xl:w-[90%]"
        >
          <Feather className="size-6 xl:hidden" />
          <span className="hidden text-headline2 font-bold xl:inline">Опубликовать</span>
        </button>
      </div>

      {me && (
        <div className="relative my-3 w-full">
          <button
            type="button"
            onClick={() => setAccount(true)}
            className="flex w-full items-center justify-center gap-3 rounded-full p-3 transition-colors hover:bg-btn-ghost-hover xl:justify-start"
          >
            <Avatar peer={me} />
            <span className="hidden min-w-0 flex-1 flex-col text-left xl:flex">
              <PeerName peer={me} link={false} handle={false} />
              <span className="truncate text-body text-secondary">{me.username ? `@${me.username}` : me.phone}</span>
            </span>
            <MoreHorizontal className="hidden size-[18.75px] xl:block" />
          </button>
          <Popover open={account} onClose={() => setAccount(false)} className="bottom-full left-0 mb-2 w-72">
            <ThemeItems />
            <MenuItem icon={<LogOut />} onClick={logout} danger>
              Выйти из @{me.username ?? me.title}
            </MenuItem>
          </Popover>
        </div>
      )}
    </header>
  )
}

export function TabBar() {
  const badges = useApp((s) => s.badges)
  const items = NAV.filter((n) => ['/home', '/explore', '/notifications', '/messages', '/profile'].includes(n.to))
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 border-t border-divider bg-header pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden">
      {items.map(({ to, label, icon, badge, fill, activeIcon }) => (
        <NavLink key={to} to={to} aria-label={label} className="flex flex-1 items-center justify-center">
          {({ isActive }) => (
            <span className="relative">
              <NavIcon icon={icon} active={isActive} fill={fill} activeIcon={activeIcon} />
              {badge && <Badge n={badges[badge]} />}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

export function ComposeFab() {
  const openCompose = useApp((s) => s.openCompose)
  return (
    <button
      type="button"
      aria-label="Опубликовать"
      onClick={() => openCompose()}
      className="x-button fixed end-4 bottom-[76px] z-30 size-14 bg-btn-brand text-white shadow-popup hover:bg-btn-brand-hover sm:hidden"
    >
      <Feather className="size-6" />
    </button>
  )
}
