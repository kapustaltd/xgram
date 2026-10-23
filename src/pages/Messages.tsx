import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BellOff, ImagePlus, Info, Pin, Reply, Search, SendHorizontal, Smile, X } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { EmojiPicker } from '../components/EmojiPicker'
import { MediaBlock } from '../components/Media'
import { PeerName, peerPath } from '../components/PeerName'
import { PostText } from '../components/PostText'
import { EmptyState, ErrorState, IconButton, Spinner } from '../components/ui'
import { fileFromTransfer, insertAtCaret } from '../lib/clipboard'
import { cn } from '../lib/cn'
import { ARCHIVE, DEFAULT_FOLDERS, folderDialogs, folderUnread } from '../lib/folders'
import { clockTime, dayLabel, fullNumber, listTime, pluralRu } from '../lib/format'
import { useAsync } from '../lib/useAsync'
import { errorText, useApi, useApp } from '../store'
import type { Dialog, Media, Peer, Post } from '../tg/types'

/** Selected folder survives the list remounting when a chat is opened. */
let lastFolder = 0

function preview(d: Dialog, meId: string, api: ReturnType<typeof useApi>) {
  const p = d.last
  if (!p) return ''
  const body = p.service ?? (p.text || (p.media[0] ? { photo: 'Фото', video: 'Видео', gif: 'GIF', sticker: 'Стикер', voice: 'Голосовое сообщение', audio: 'Аудио', document: 'Файл', webpage: 'Ссылка', poll: 'Опрос', geo: 'Геопозиция' }[p.media[0].kind] : ''))
  if (p.out && !d.peer.isSelf) return `Вы: ${body}`
  if (d.peer.kind === 'group' && p.senderId && p.senderId !== meId) {
    const s = api.peerSync(p.senderId)
    if (s) return `${s.title.split(' ')[0]}: ${body}`
  }
  return body
}

function DialogList({ activeId }: { activeId?: string }) {
  const api = useApi()
  const me = useApp((s) => s.me)!
  const navigate = useNavigate()
  const [folderId, setFolderIdState] = useState(lastFolder)
  const [q, setQ] = useState('')
  const { data, error, loading, reload } = useAsync(() => api.getDialogs(), [api])
  const { data: userFolders } = useAsync(() => api.getFolders().catch(() => []), [api])
  const tabs = useRef<HTMLDivElement>(null)

  // Mouse wheel scrolls the folder tabs sideways when they overflow.
  useEffect(() => {
    const el = tabs.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const off = api.subscribe(() => {
      clearTimeout(t)
      t = setTimeout(reload, 400)
    })
    return () => {
      off()
      clearTimeout(t)
    }
  }, [api, reload])

  const folders = useMemo(() => {
    const own = userFolders && userFolders.length > 1 ? userFolders : DEFAULT_FOLDERS
    return data?.some((d) => d.archived) ? [...own, ARCHIVE] : own
  }, [userFolders, data])
  const folder = folders.find((f) => f.id === folderId) ?? folders[0]
  const setFolder = (id: number) => {
    lastFolder = id
    setFolderIdState(id)
  }

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return folderDialogs(data ?? [], folder).filter((d) => !ql || d.peer.title.toLowerCase().includes(ql) || d.peer.username?.toLowerCase().includes(ql))
  }, [data, folder, q])

  return (
    <section className={cn('min-w-0 flex-col overflow-y-auto border-divider md:w-[390px] md:shrink-0 md:border-e', activeId ? 'hidden md:flex' : 'flex w-full')}>
      <div className="sticky top-0 z-20 bg-header backdrop-blur-md">
        <div className="flex h-[53px] items-center px-4">
          <h1 className="flex-1 text-headline1 font-bold">Сообщения</h1>
        </div>
        <div className="px-4 pb-2">
          <label className="group flex h-10 items-center gap-2 rounded-full border border-normal px-3 focus-within:border-brand">
            <Search className="size-4 text-secondary group-focus-within:text-brand" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск в Сообщениях" className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-secondary" />
          </label>
        </div>
        <div ref={tabs} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {folders.map((f) => {
            const active = f.id === folder.id
            const unread = data ? folderUnread(data, f) : 0
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolder(f.id)}
                className={cn('x-button h-8 shrink-0 gap-1.5 px-4 text-subtext1', active ? 'bg-btn-primary text-inverted' : 'border border-normal text-primary hover:bg-btn-ghost-hover')}
              >
                {f.title}
                {unread > 0 && (
                  <span className={cn('flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-subtext3 font-bold', active ? 'bg-inverted text-primary' : 'bg-brand text-white')}>
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {loading && !data && <Spinner />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && list.length === 0 && <p className="px-4 py-8 text-center text-body text-secondary">{q.trim() ? 'Ничего не найдено' : 'В этой папке пока нет чатов'}</p>}
      {list.map((d) => {
        const active = d.peer.id === activeId
        return (
          <button
            key={d.peer.id}
            type="button"
            onClick={() => navigate(d.peer.kind === 'channel' ? peerPath(d.peer) : `/messages/${d.peer.id}`)}
            className={cn('relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors', active ? 'bg-hover-subtle' : 'hover:bg-hover-faint')}
          >
            {active && <span className="absolute inset-y-0 end-0 w-0.5 bg-brand" />}
            <Avatar peer={d.peer} saved={d.peer.isSelf} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 items-center gap-1 text-body">
                <span className="flex min-w-0 flex-1 items-center gap-1">
                  {d.peer.isSelf ? <span className="truncate font-bold">Избранное</span> : <PeerName peer={d.peer} link={false} />}
                  {d.muted && <BellOff className="size-3.5 shrink-0 text-secondary" />}
                </span>
                {d.last && <span className="shrink-0 text-subtext1 text-secondary">{listTime(d.last.date)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('min-w-0 flex-1 truncate text-body', d.unread ? 'text-primary' : 'text-secondary')}>{preview(d, me.id, api)}</span>
                {d.pinned && !d.unread && <Pin className="size-3.5 shrink-0 rotate-45 text-secondary" />}
                {d.unreadMentions > 0 && <span className="flex size-5 items-center justify-center rounded-full bg-brand text-subtext3 font-bold text-white">@</span>}
                {d.unread > 0 && (
                  <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-subtext3 font-bold text-white', d.muted ? 'bg-tertiary' : 'bg-brand')}>
                    {d.unread > 999 ? '999+' : d.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </section>
  )
}

function Bubble({ post, first, last, showSender, onReply, replyTo }: { post: Post; first: boolean; last: boolean; showSender: boolean; onReply: () => void; replyTo?: Post }) {
  const api = useApi()
  const sender = post.senderId ? api.peerSync(post.senderId) : undefined
  if (post.service) {
    return (
      <div className="py-2 text-center text-subtext2 text-secondary">
        {sender && !post.out ? `${sender.title} ` : post.out ? 'Вы ' : ''}
        {post.service}
      </div>
    )
  }
  const visualOnly = !post.text && post.media.length > 0 && post.media.every((m) => m.kind !== 'webpage')
  return (
    <div className={cn('group flex items-end gap-2', post.out ? 'flex-row-reverse' : 'flex-row', last ? 'mb-3' : 'mb-0.5')}>
      {showSender && !post.out && <div className="w-8 shrink-0">{last && sender && <Link to={peerPath(sender)}><Avatar peer={sender} size={32} /></Link>}</div>}
      <div className={cn('flex max-w-[80%] min-w-0 flex-col', post.out ? 'items-end' : 'items-start')}>
        {showSender && first && !post.out && sender && <span className="mb-1 ps-3 text-subtext2 font-bold text-secondary">{sender.title}</span>}
        <div
          className={cn(
            'min-w-0 overflow-hidden',
            visualOnly ? 'rounded-[16px]' : 'rounded-[24px] px-4 py-3',
            !visualOnly && (post.out ? 'bg-brand text-white' : 'bg-bubble-in text-primary'),
            !visualOnly && post.out && last && 'rounded-ee-[4px]',
            !visualOnly && !post.out && last && 'rounded-es-[4px]',
          )}
        >
          {post.forwardedFrom && <div className={cn('mb-1 text-subtext2 font-bold', post.out ? 'text-white/80' : 'text-brand')}>Переслано из {post.forwardedFrom}</div>}
          {replyTo && (
            <div className={cn('mb-2 border-s-2 ps-2 text-subtext2', post.out ? 'border-white/70 text-white/80' : 'border-brand text-secondary')}>
              <div className="line-clamp-2">{replyTo.text || 'Медиа'}</div>
            </div>
          )}
          {post.media.length > 0 && (
            <div className={cn(!visualOnly && 'mb-2', '[&_a]:text-inherit')}>
              <MediaBlock media={post.media} />
            </div>
          )}
          <PostText text={post.text} entities={post.entities} className={cn(post.out && '[&_a]:text-white [&_a]:underline')} />
        </div>
        {last && (
          <span className="mt-1 px-1 text-subtext2 text-secondary">
            {clockTime(post.date)}
            {post.edited && ' · изменено'}
          </span>
        )}
      </div>
      <button type="button" aria-label="Ответить" onClick={onReply} className="x-button mb-1 size-8 text-secondary opacity-0 group-hover:opacity-100 hover:bg-btn-ghost-hover">
        <Reply className="size-4" />
      </button>
    </div>
  )
}

function FileChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file.type.startsWith('image/')) return
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  return (
    <div className="relative mb-2 w-fit overflow-hidden rounded-md border border-normal">
      {url ? <img src={url} alt="" className="max-h-48 max-w-full object-contain" /> : <div className="px-4 py-3 text-body">📎 {file.name}</div>}
      <button type="button" aria-label="Убрать файл" onClick={onRemove} className="x-button absolute end-1 top-1 size-8 bg-black/75 text-white hover:bg-black/60">
        <X className="size-[18px]" />
      </button>
    </div>
  )
}

function ChatInput({
  peer,
  onSent,
  replyTo,
  clearReply,
  dropped,
}: {
  peer: Peer
  onSent: (p: Post | null) => void
  replyTo?: Post
  clearReply: () => void
  /** File dropped onto the chat area. */
  dropped?: File | null
}) {
  const api = useApi()
  const toast = useApp((s) => s.showToast)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [picker, setPicker] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  useEffect(() => {
    if (replyTo) ta.current?.focus()
  }, [replyTo])

  useEffect(() => {
    if (dropped) setFile(dropped)
  }, [dropped])

  async function send() {
    if ((!text.trim() && !file) || busy) return
    setBusy(true)
    try {
      const p = await api.sendMessage(peer.id, text.trim(), { file: file ?? undefined, replyTo: replyTo?.id })
      setText('')
      setFile(null)
      clearReply()
      onSent(p)
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function sendDocument(m: Media) {
    try {
      const p = await api.sendDocument(peer.id, m, { replyTo: replyTo?.id })
      clearReply()
      onSent(p)
    } catch (e) {
      toast(errorText(e))
    }
  }

  function insertEmoji(e: string) {
    const [value, caret] = insertAtCaret(ta.current, text, e)
    setText(value)
    requestAnimationFrame(() => {
      ta.current?.focus()
      ta.current?.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="relative shrink-0 border-t border-divider bg-surface px-3 py-2">
      {picker && <EmojiPicker className="bottom-full left-3 mb-2" onEmoji={insertEmoji} onDocument={sendDocument} onClose={() => setPicker(false)} />}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-hover-subtle px-3 py-2 text-subtext1">
          <Reply className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 truncate text-secondary">Ответ: {replyTo.text || 'медиа'}</span>
          <button type="button" aria-label="Отмена" onClick={clearReply} className="text-secondary hover:text-primary">
            <X className="size-4" />
          </button>
        </div>
      )}
      {file && <FileChip file={file} onRemove={() => setFile(null)} />}
      <div className="flex items-end gap-1 rounded-[16px] bg-inputs px-1 py-1">
        <button type="button" aria-label="Медиа" onClick={() => fileInput.current?.click()} className="x-button size-[34px] text-brand hover:bg-brand/10">
          <ImagePlus className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Эмодзи и стикеры"
          data-picker-toggle
          onClick={() => setPicker((v) => !v)}
          className={cn('x-button size-[34px] text-brand hover:bg-brand/10', picker && 'bg-brand/10')}
        >
          <Smile className="size-5" />
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
        <textarea
          ref={ta}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const f = fileFromTransfer(e.clipboardData)
            if (!f) return
            e.preventDefault()
            setFile(f)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={file ? 'Добавьте подпись' : 'Начните новое сообщение'}
          className="min-w-0 flex-1 resize-none bg-transparent px-2 py-[7px] text-body outline-none placeholder:text-secondary"
        />
        <button type="button" aria-label="Отправить" disabled={(!text.trim() && !file) || busy} onClick={send} className="x-button size-[34px] text-brand hover:bg-brand/10 disabled:opacity-40">
          <SendHorizontal className="size-5" />
        </button>
      </div>
    </div>
  )
}

function Chat({ peerId }: { peerId: string }) {
  const api = useApi()
  const navigate = useNavigate()
  const { data: peer } = useAsync(() => api.getPeer(peerId), [api, peerId])
  const { data, error, loading, reload, setData } = useAsync(() => api.getHistory(peerId, { limit: 60 }), [api, peerId])
  const [replyTo, setReplyTo] = useState<Post | undefined>()
  const [dropped, setDropped] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.markRead(peerId)
    setReplyTo(undefined)
  }, [api, peerId])

  useEffect(
    () =>
      api.subscribe((ev) => {
        if (ev.type !== 'message' || ev.post.peerId !== peerId) return
        setData((list) => (list?.some((p) => p.id === ev.post.id) ? list : [ev.post, ...(list ?? [])]))
        api.markRead(peerId)
      }),
    [api, peerId, setData],
  )

  const messages = useMemo(() => [...(data ?? [])].sort((a, b) => a.date - b.date || a.id - b.id), [data])
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages])

  useLayoutEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, peerId])

  const isGroup = peer?.kind === 'group'
  const status = peer
    ? peer.isSelf
      ? 'Сохранённые сообщения'
      : peer.kind === 'bot'
        ? 'бот'
        : peer.members
          ? `${fullNumber(peer.members)} ${pluralRu(peer.members, 'участник', 'участника', 'участников')}`
          : peer.username
            ? `@${peer.username}`
            : ''
    : ''

  return (
    <section
      className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        setDropped(fileFromTransfer(e.dataTransfer))
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 flex items-center justify-center rounded-md border-2 border-dashed border-brand bg-brand/10 text-headline2 font-bold text-brand">
          Отпустите, чтобы прикрепить
        </div>
      )}
      <div className="flex h-[53px] shrink-0 items-center gap-3 border-b border-divider px-2 md:px-4">
        <IconButton label="Назад" className="md:hidden" onClick={() => navigate('/messages')}>
          <ArrowLeft />
        </IconButton>
        {peer && (
          <Link to={peer.isSelf ? '/bookmarks' : peerPath(peer)} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar peer={peer} saved={peer.isSelf} size={32} />
            <div className="flex min-w-0 flex-col">
              {peer.isSelf ? <span className="text-headline2 font-bold">Избранное</span> : <PeerName peer={peer} link={false} handle={false} nameClass="text-headline2" />}
              {status && <span className="truncate text-subtext2 text-secondary">{status}</span>}
            </div>
          </Link>
        )}
        {peer && !peer.isSelf && (
          <IconButton label="Информация" onClick={() => navigate(peerPath(peer))}>
            <Info />
          </IconButton>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-4">
        <div className="flex-1" />
        {loading && !data && <Spinner />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {peer && data && messages.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Avatar peer={peer} size={64} />
            <span className="text-headline2 font-bold">{peer.title}</span>
            <span className="text-body text-secondary">Начните переписку — напишите первое сообщение.</span>
          </div>
        )}
        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const next = messages[i + 1]
          const newDay = !prev || new Date(prev.date).toDateString() !== new Date(m.date).toDateString()
          const sameAsPrev = prev && !newDay && prev.senderId === m.senderId && m.date - prev.date < 5 * 60_000 && !prev.service
          const sameAsNext = next && next.senderId === m.senderId && next.date - m.date < 5 * 60_000 && new Date(next.date).toDateString() === new Date(m.date).toDateString() && !next.service
          return (
            <div key={`${m.peerId}:${m.id}`}>
              {newDay && <div className="py-3 text-center text-subtext2 text-secondary">{dayLabel(m.date)}</div>}
              <Bubble post={m} first={!sameAsPrev} last={!sameAsNext} showSender={isGroup} onReply={() => setReplyTo(m)} replyTo={m.replyToId ? byId.get(m.replyToId) : undefined} />
            </div>
          )
        })}
        <div ref={bottom} />
      </div>

      {peer && (
        <ChatInput
          peer={peer}
          replyTo={replyTo}
          dropped={dropped}
          clearReply={() => setReplyTo(undefined)}
          onSent={(p) => p && setData((list) => (list?.some((x) => x.id === p.id) ? list : [p, ...(list ?? [])]))}
        />
      )}
    </section>
  )
}

export function Messages() {
  const { peerId } = useParams()
  return (
    <div className="flex h-[calc(100dvh-56px)] sm:h-dvh">
      <DialogList activeId={peerId} />
      {peerId ? (
        <Chat key={peerId} peerId={peerId} />
      ) : (
        <section className="hidden flex-1 items-center md:flex">
          <EmptyState title="Выберите чат" text="Выберите переписку из списка слева или начните новую со страницы профиля." />
        </section>
      )}
    </div>
  )
}
