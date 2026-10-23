import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ImagePlus, Search, Smile, X } from 'lucide-react'
import { fileFromTransfer, insertAtCaret } from '../lib/clipboard'
import { cn } from '../lib/cn'
import { useAsync } from '../lib/useAsync'
import { errorText, useApi, useApp, type ComposeTarget } from '../store'
import type { Peer, Post } from '../tg/types'
import { Avatar } from './Avatar'
import { EmojiPicker } from './EmojiPicker'
import { PeerName } from './PeerName'
import { Button, Modal, ModalClose, Popover } from './ui'

const LIMIT = 4096

function Counter({ length }: { length: number }) {
  if (!length) return null
  const r = 10
  const c = 2 * Math.PI * r
  const ratio = Math.min(1, length / LIMIT)
  const left = LIMIT - length
  const color = left < 0 ? 'stroke-x-red' : left < 200 ? 'stroke-x-yellow' : 'stroke-brand'
  return (
    <div className="flex items-center gap-2">
      {left < 200 && <span className={cn('text-subtext2', left < 0 ? 'text-x-red' : 'text-secondary')}>{left}</span>}
      <svg viewBox="0 0 24 24" className="size-[22px] -rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" strokeWidth="2" className="stroke-divider" />
        <circle cx="12" cy="12" r={r} fill="none" strokeWidth="2" className={color} strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} />
      </svg>
    </div>
  )
}

function TargetPicker({ value, onChange }: { value?: Peer; onChange: (p: Peer) => void }) {
  const api = useApi()
  const me = useApp((s) => s.me)!
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const { data } = useAsync(() => (open ? api.getDialogs() : Promise.resolve([])), [api, open])
  const list = useMemo(
    () =>
      (data ?? [])
        .map((d) => d.peer)
        .filter((p) => !p.isSelf && p.title.toLowerCase().includes(q.toLowerCase()))
        .slice(0, 40),
    [data, q],
  )
  const label = !value || value.isSelf ? 'Избранное' : value.title
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-6 max-w-[260px] items-center gap-1 rounded-full border border-normal px-3 text-subtext1 font-bold text-brand transition-colors hover:bg-brand/10"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="size-4 shrink-0" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="top-8 left-0 w-80">
        <div className="px-4 pt-3 pb-1 text-headline2 font-extrabold">Куда опубликовать</div>
        <div className="mx-3 my-2 flex h-9 items-center gap-2 rounded-full bg-inputs px-3">
          <Search className="size-4 text-secondary" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск чатов" autoFocus className="min-w-0 flex-1 bg-transparent text-body outline-none" />
        </div>
        <div className="max-h-72 overflow-y-auto">
          {!q && (
            <button type="button" onClick={() => onChange(me)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover-subtle">
              <Avatar peer={me} saved size={32} />
              <span className="text-body font-bold">Избранное</span>
            </button>
          )}
          {list.map((p) => (
            <button key={p.id} type="button" onClick={() => onChange(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hover-subtle">
              <Avatar peer={p} size={32} />
              <PeerName peer={p} link={false} handle={false} className="text-body" />
            </button>
          ))}
        </div>
      </Popover>
    </div>
  )
}

export function Composer({
  target,
  placeholder = 'Что происходит?',
  submitLabel = 'Опубликовать',
  onSent,
  autoFocus,
  inline,
}: {
  target?: ComposeTarget
  placeholder?: string
  submitLabel?: string
  onSent?: (p: Post | null) => void
  autoFocus?: boolean
  inline?: boolean
}) {
  const api = useApi()
  const me = useApp((s) => s.me)!
  const toast = useApp((s) => s.showToast)
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dest, setDest] = useState<Peer | undefined>(target?.peerId ? api.peerSync(target.peerId) : undefined)
  const [focused, setFocused] = useState(false)
  const [picker, setPicker] = useState(false)
  const emojiBtn = useRef<HTMLButtonElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const fixedTarget = !!target?.peerId

  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  useEffect(() => {
    if (!file?.type.startsWith('image/')) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const canSend = (text.trim().length > 0 || !!file) && text.length <= LIMIT && !busy

  async function submit() {
    if (!canSend) return
    setBusy(true)
    try {
      const peerId = target?.peerId ?? dest?.id ?? me.id
      const sent = await api.sendMessage(peerId, text.trim(), { file: file ?? undefined, commentTo: target?.commentTo, replyTo: target?.replyTo })
      setText('')
      setFile(null)
      toast(target?.commentTo ? 'Комментарий отправлен' : `Отправлено${!fixedTarget && (!dest || dest.isSelf) ? ' в Избранное' : ''}`)
      onSent?.(sent)
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('flex gap-2 px-4', inline ? 'border-b border-divider pt-1 pb-2' : 'pt-1 pb-3')}>
      <div className="w-10 shrink-0 pt-3">
        <Avatar peer={me} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {!fixedTarget && (!inline || focused || text) && (
          <div className="pt-3">
            <TargetPicker value={dest} onChange={setDest} />
          </div>
        )}
        {target?.title && (
          <div className="pt-3 text-body text-secondary">
            {target.commentTo ? 'Комментарий к посту в ' : target.replyTo ? 'Ответ в ' : 'В '}
            <span className="text-brand">{target.title}</span>
          </div>
        )}
        <textarea
          ref={ta}
          value={text}
          rows={1}
          autoFocus={autoFocus}
          onFocus={() => setFocused(true)}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const f = fileFromTransfer(e.clipboardData)
            if (!f) return
            e.preventDefault()
            setFile(f)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
          }}
          placeholder={placeholder}
          className={cn('w-full resize-none bg-transparent py-3 text-[20px] leading-6 outline-none placeholder:text-secondary', !inline && 'min-h-[96px]')}
        />
        {file && (
          <div className="relative mb-3 w-fit overflow-hidden rounded-md border border-normal">
            {preview ? (
              <img src={preview} alt="" className="max-h-72 object-cover" />
            ) : (
              <div className="px-4 py-3 text-body">📎 {file.name}</div>
            )}
            <button
              type="button"
              aria-label="Убрать файл"
              onClick={() => setFile(null)}
              className="x-button absolute end-1 top-1 size-8 bg-black/75 text-white hover:bg-black/60"
            >
              <X className="size-[18px]" />
            </button>
          </div>
        )}
        <div className={cn('flex items-center justify-between', (!inline || focused || text) && 'border-t border-divider pt-2')}>
          <div className="relative -ms-2 flex text-brand">
            <button type="button" aria-label="Медиа" onClick={() => fileInput.current?.click()} className="x-button size-[34px] hover:bg-brand/10">
              <ImagePlus className="size-5" />
            </button>
            <button ref={emojiBtn} type="button" aria-label="Эмодзи" data-picker-toggle onClick={() => setPicker((v) => !v)} className="x-button size-[34px] hover:bg-brand/10">
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
            {picker && (
              <EmojiPicker
                anchor={emojiBtn}
                onClose={() => setPicker(false)}
                onEmoji={(emoji) => {
                  const [value, caret] = insertAtCaret(ta.current, text, emoji)
                  setText(value)
                  requestAnimationFrame(() => ta.current?.setSelectionRange(caret, caret))
                }}
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <Counter length={text.length} />
            <Button disabled={!canSend} onClick={submit}>
              {busy ? 'Отправка…' : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ComposeModal() {
  const compose = useApp((s) => s.compose)
  const close = useApp((s) => s.closeCompose)
  return (
    <Modal open={!!compose} onClose={close} label="Новый пост">
      <div className="flex h-[53px] shrink-0 items-center px-2">
        <ModalClose onClose={close} />
      </div>
      <div className="overflow-y-auto">
        {compose && (
          <Composer
            target={compose}
            autoFocus
            submitLabel={compose.commentTo || compose.replyTo ? 'Ответить' : 'Опубликовать'}
            placeholder={compose.commentTo || compose.replyTo ? 'Опубликуйте ответ' : 'Что происходит?'}
            onSent={close}
          />
        )}
      </div>
    </Modal>
  )
}
