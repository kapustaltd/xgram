import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronRight, Plus, Search, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { feedPeers, newFeed, type CustomFeed } from '../lib/feed'
import { pluralRu } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { useApi } from '../store'
import { Avatar } from './Avatar'
import { PeerName } from './PeerName'
import { Button, IconButton, Modal, ModalClose, TextField } from './ui'

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="border-b border-divider px-4 py-4">
      <h3 className="text-headline2 font-extrabold">{title}</h3>
      {hint && <p className="mt-0.5 text-subtext1 text-secondary">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-2 text-left">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body">{label}</span>
        {sub && <span className="text-subtext2 text-secondary">{sub}</span>}
      </span>
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-tertiary')}>
        <span className={cn('absolute top-0.5 size-4 rounded-full bg-white transition-[left]', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
    </button>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('x-button h-8 gap-1.5 px-4 text-subtext1', active ? 'bg-btn-primary text-inverted' : 'border border-normal text-primary hover:bg-btn-ghost-hover')}
    >
      {active && <Check className="size-4" />}
      {children}
    </button>
  )
}

function Editor({ initial, isNew, onSave, onDelete, onBack }: { initial: CustomFeed; isNew: boolean; onSave: (f: CustomFeed) => void; onDelete: () => void; onBack: () => void }) {
  const api = useApi()
  const [feed, setFeed] = useState(initial)
  const [q, setQ] = useState('')
  const { data } = useAsync(() => Promise.all([api.getDialogs(), api.getFolders().catch(() => [])]), [api])
  const [dialogs, folders] = data ?? [[], []]
  const userFolders = folders.filter((f) => f.id > 0)
  const set = (patch: Partial<CustomFeed>) => setFeed((f) => ({ ...f, ...patch }))

  const chats = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return dialogs
      .map((d) => d.peer)
      .filter((p) => (p.kind === 'channel' || p.kind === 'group') && (!ql || p.title.toLowerCase().includes(ql) || p.username?.toLowerCase().includes(ql)))
      .slice(0, ql ? 40 : 12)
  }, [dialogs, q])
  const reads = data ? feedPeers(feed, dialogs, folders).length : 0

  function toggleFolder(id: number, title: string) {
    const on = feed.folders.includes(id)
    set({ folders: on ? feed.folders.filter((x) => x !== id) : [...feed.folders, id], title: !on && !feed.title.trim() ? title : feed.title })
  }
  const togglePeer = (id: string) => set({ peers: feed.peers.includes(id) ? feed.peers.filter((x) => x !== id) : [...feed.peers, id] })

  return (
    <>
      <div className="flex h-[53px] shrink-0 items-center gap-4 px-2">
        <IconButton label="Назад" onClick={onBack}>
          <ArrowLeft />
        </IconButton>
        <h2 className="flex-1 text-headline1 font-bold">{isNew ? 'Новая лента' : 'Настройка ленты'}</h2>
        <Button size="sm" disabled={!feed.title.trim()} onClick={() => onSave({ ...feed, title: feed.title.trim() })}>
          Сохранить
        </Button>
      </div>
      <div className="overflow-y-auto">
        <div className="px-4 pb-4">
          <TextField label="Название вкладки" value={feed.title} onChange={(v) => set({ title: v })} maxLength={24} autoFocus={isNew} />
          <p className="mt-2 text-subtext1 text-secondary">
            {feed.folders.length || feed.peers.length ? 'Лента' : 'Ничего не выбрано — лента'} читает {reads} {pluralRu(reads, 'чат', 'чата', 'чатов')}
          </p>
        </div>

        <Section title="Папки Telegram" hint="Посты из всех подходящих чатов выбранных папок.">
          {userFolders.length ? (
            <div className="flex flex-wrap gap-2">
              {userFolders.map((f) => (
                <Chip key={f.id} active={feed.folders.includes(f.id)} onClick={() => toggleFolder(f.id, f.title)}>
                  {f.emoticon && <span>{f.emoticon}</span>}
                  {f.title}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-body text-secondary">{data ? 'В вашем Telegram нет папок — выберите каналы ниже.' : 'Загрузка…'}</p>
          )}
        </Section>

        <Section title="Каналы и группы" hint="Добавленные вручную показываются всегда.">
          {feed.peers.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {feed.peers.map((id) => {
                const p = api.peerSync(id)
                return (
                  <button key={id} type="button" onClick={() => togglePeer(id)} className="x-button h-8 gap-1.5 bg-btn-secondary ps-1 pe-3 text-subtext1 hover:bg-btn-secondary-hover">
                    <Avatar peer={p} size={24} />
                    <span className="max-w-40 truncate">{p?.title ?? id}</span>
                    <X className="size-3.5 text-secondary" />
                  </button>
                )
              })}
            </div>
          )}
          <label className="group flex h-10 items-center gap-2 rounded-full border border-normal px-3 focus-within:border-brand">
            <Search className="size-4 text-secondary group-focus-within:text-brand" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти канал или группу" className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-secondary" />
          </label>
          <div className="-mx-4 mt-2">
            {chats.map((p) => {
              const on = feed.peers.includes(p.id)
              return (
                <button key={p.id} type="button" onClick={() => togglePeer(p.id)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-hover-subtle">
                  <Avatar peer={p} size={36} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <PeerName peer={p} link={false} handle={false} className="text-body" />
                    <span className="text-subtext2 text-secondary">{p.kind === 'channel' ? 'Канал' : 'Группа'}</span>
                  </span>
                  <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border-2', on ? 'border-brand bg-brand text-white' : 'border-normal')}>
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Что показывать">
          <Toggle label="Каналы" checked={feed.channels} onChange={(v) => set({ channels: v })} />
          <Toggle label="Группы" sub="Сообщения из групповых чатов" checked={feed.groups} onChange={(v) => set({ groups: v })} />
          <Toggle label="Только с фото и видео" checked={!!feed.mediaOnly} onChange={(v) => set({ mediaOnly: v })} />
          <Toggle label="Скрывать репосты" sub="Пересланные сообщения" checked={!!feed.hideForwards} onChange={(v) => set({ hideForwards: v })} />
          <Toggle label="Без чатов с выключенными уведомлениями" checked={!!feed.hideMuted} onChange={(v) => set({ hideMuted: v })} />
        </Section>

        <Section title="Сортировка">
          <div className="flex gap-2">
            <Chip active={feed.sort === 'new'} onClick={() => set({ sort: 'new' })}>
              Сначала новые
            </Chip>
            <Chip active={feed.sort === 'top'} onClick={() => set({ sort: 'top' })}>
              Популярные
            </Chip>
          </div>
        </Section>

        {!isNew && (
          <div className="px-4 py-4">
            <Button variant="outline" className="w-full border-x-red/50 text-x-red hover:bg-x-red/10" onClick={onDelete}>
              Удалить ленту
            </Button>
          </div>
        )}
      </div>
    </>
  )
}

function describe(f: CustomFeed) {
  const parts = [f.channels && 'каналы', f.groups && 'группы'].filter(Boolean).join(' и ')
  const src = f.folders.length || f.peers.length ? `${f.folders.length} ${pluralRu(f.folders.length, 'папка', 'папки', 'папок')}, ${f.peers.length} ${pluralRu(f.peers.length, 'чат', 'чата', 'чатов')}` : 'все чаты'
  return `${src} · ${parts || 'только выбранные'} · ${f.sort === 'top' ? 'популярные' : 'новые'}`
}

/** «+» on Home: list of custom feed tabs and their editor. `edit` opens a feed (or 'new') directly. */
export function FeedSettings({
  feeds,
  edit,
  onChange,
  onClose,
}: {
  feeds: CustomFeed[]
  edit: string | 'new' | 'list' | null
  onChange: (feeds: CustomFeed[], select?: string) => void
  onClose: () => void
}) {
  const [view, setView] = useState(edit)
  const editing = view === 'new' ? newFeed() : feeds.find((f) => f.id === view)
  const back = () => (edit === 'list' ? setView('list') : onClose())

  function move(i: number, d: number) {
    const next = [...feeds]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    onChange(next)
  }

  return (
    <Modal open={!!edit} onClose={onClose} label="Настройка ленты">
      {editing ? (
        <Editor
          key={view}
          initial={editing}
          isNew={view === 'new'}
          onBack={back}
          onSave={(f) => {
            onChange(view === 'new' ? [...feeds, f] : feeds.map((x) => (x.id === f.id ? f : x)), f.id)
            back()
          }}
          onDelete={() => {
            onChange(feeds.filter((x) => x.id !== editing.id))
            back()
          }}
        />
      ) : (
        <>
          <div className="flex h-[53px] shrink-0 items-center gap-4 px-2">
            <ModalClose onClose={onClose} />
            <h2 className="flex-1 text-headline1 font-bold">Ленты на главной</h2>
          </div>
          <div className="overflow-y-auto pb-4">
            <p className="px-4 pb-3 text-body text-secondary">Свои вкладки рядом с «Для вас» и «Подписки»: посты из выбранных папок Telegram, каналов и групп.</p>
            {feeds.map((f, i) => (
              <div key={f.id} className="flex items-center gap-1 border-t border-divider ps-4 pe-2">
                <button type="button" onClick={() => setView(f.id)} className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-bold">{f.title}</span>
                    <span className="truncate text-subtext2 text-secondary">{describe(f)}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-secondary" />
                </button>
                <IconButton label="Выше" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30 [&_svg]:size-4">
                  <ArrowUp />
                </IconButton>
                <IconButton label="Ниже" disabled={i === feeds.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30 [&_svg]:size-4">
                  <ArrowDown />
                </IconButton>
              </div>
            ))}
            <button type="button" onClick={() => setView('new')} className="flex w-full items-center gap-3 border-t border-divider px-4 py-3 text-body font-bold text-brand hover:bg-hover-faint">
              <Plus className="size-5" /> Добавить ленту
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
