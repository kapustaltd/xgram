import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAsync } from '../lib/useAsync'
import { errorText, useApi, useApp } from '../store'
import type { EditableProfile, UsernameCheck } from '../tg/types'
import { gradientFor, useAvatarUrl } from './Avatar'
import { Button, ModalClose, Modal, Spinner, TextField } from './ui'

const USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/

/** Center-crop to a square JPEG — Telegram profile photos are square. */
async function squareJpeg(file: File, size = 640): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const side = Math.min(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(size, side)
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Не удалось обработать фото'))), 'image/jpeg', 0.92))
}

type Photo = { kind: 'keep' } | { kind: 'remove' } | { kind: 'new'; blob: Blob; url: string }
type NameStatus = 'idle' | 'checking' | UsernameCheck

function UsernameHint({ status, username }: { status: NameStatus; username: string }) {
  if (status === 'idle') return username ? <p className="px-1 pt-1.5 text-subtext2 text-secondary">Ссылка на профиль: t.me/{username}</p> : null
  const text = {
    checking: ['text-secondary', 'Проверяем…'],
    ok: ['text-x-green', `@${username} свободно`],
    taken: ['text-x-red', 'Это имя пользователя уже занято'],
    invalid: ['text-x-red', 'От 5 до 32 символов: латиница, цифры и _, начинается с буквы'],
  }[status]
  return <p className={cn('px-1 pt-1.5 text-subtext2', text[0])}>{text[1]}</p>
}

function Form({ initial, onClose, onSaved }: { initial: EditableProfile; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const me = useApp((s) => s.me)!
  const refreshMe = useApp((s) => s.refreshMe)
  const toast = useApp((s) => s.showToast)
  const [form, setForm] = useState(initial)
  const [photo, setPhoto] = useState<Photo>({ kind: 'keep' })
  const [nameStatus, setNameStatus] = useState<NameStatus>('idle')
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const currentAvatar = useAvatarUrl(me.id)

  const set = <K extends keyof EditableProfile>(k: K, v: EditableProfile[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Debounced availability check, only when the username actually changed.
  useEffect(() => {
    const u = form.username.trim()
    if (u === initial.username || !u) return setNameStatus('idle')
    if (!USERNAME_RE.test(u)) return setNameStatus('invalid')
    setNameStatus('checking')
    let alive = true
    const t = setTimeout(() => {
      api.checkUsername(u).then(
        (r) => alive && setNameStatus(r),
        () => alive && setNameStatus('idle'),
      )
    }, 450)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [api, form.username, initial.username])

  useEffect(() => () => void (photo.kind === 'new' && URL.revokeObjectURL(photo.url)), [photo])

  const textChanged = form.firstName !== initial.firstName || form.lastName !== initial.lastName || form.about !== initial.about
  const usernameChanged = form.username.trim() !== initial.username
  const dirty = textChanged || usernameChanged || photo.kind !== 'keep'
  const valid = form.firstName.trim().length > 0 && form.about.length <= initial.aboutLimit && (!usernameChanged || !form.username.trim() || nameStatus === 'ok')

  async function pick(file: File | undefined) {
    if (!file) return
    try {
      const blob = await squareJpeg(file)
      setPhoto({ kind: 'new', blob, url: URL.createObjectURL(blob) })
    } catch (e) {
      toast(errorText(e))
    }
  }

  async function save() {
    if (!dirty || !valid || saving) return
    setSaving(true)
    try {
      if (photo.kind === 'new') await api.setProfilePhoto(photo.blob)
      if (photo.kind === 'remove') await api.setProfilePhoto(null)
      if (textChanged) await api.updateProfile({ firstName: form.firstName.trim(), lastName: form.lastName.trim(), about: form.about.trim() })
      if (usernameChanged) await api.updateUsername(form.username.trim())
      await refreshMe({ photoChanged: photo.kind !== 'keep' })
      toast('Профиль обновлён')
      onSaved()
      onClose()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setSaving(false)
    }
  }

  const shownPhoto = photo.kind === 'new' ? photo.url : photo.kind === 'remove' ? null : currentAvatar
  const [a, b] = gradientFor(me.id)

  return (
    <>
      <div className="flex h-[53px] shrink-0 items-center gap-6 px-2">
        <ModalClose onClose={onClose} />
        <h2 className="flex-1 text-headline1 font-bold">Изменить профиль</h2>
        <Button size="sm" disabled={!dirty || !valid || saving} onClick={save} className="me-2">
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
      <div className="overflow-y-auto pb-6">
        {/* Telegram has no banners: the profile page derives one from the photo, mirror that here */}
        <div className="relative aspect-[3/1] overflow-hidden bg-surface-3">
          {shownPhoto ? (
            <img src={shownPhoto} alt="" className="size-full scale-125 object-cover blur-2xl brightness-75" />
          ) : (
            <div className="size-full opacity-80" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} />
          )}
        </div>
        <div className="relative -mt-12 ms-4 size-[112px]">
          <div className="size-full overflow-hidden rounded-full border-4 border-surface bg-surface">
            {shownPhoto ? (
              <img src={shownPhoto} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-[40px] font-bold text-white" style={{ background: `linear-gradient(180deg, ${a}, ${b})` }}>
                {(form.firstName[0] ?? '') + (form.lastName[0] ?? '')}
              </div>
            )}
          </div>
          <div className="absolute inset-0 flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Загрузить фото"
              title="Загрузить фото"
              onClick={() => fileInput.current?.click()}
              className="x-button size-[42px] bg-black/60 text-white backdrop-blur-sm hover:bg-black/40"
            >
              <Camera className="size-5" />
            </button>
            {shownPhoto && (
              <button
                type="button"
                aria-label="Удалить фото"
                title="Удалить фото"
                onClick={() => setPhoto(photo.kind === 'new' ? { kind: 'keep' } : { kind: 'remove' })}
                className="x-button size-[42px] bg-black/60 text-white backdrop-blur-sm hover:bg-black/40"
              >
                <X className="size-5" />
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        <div className="flex flex-col gap-6 px-4 pt-6">
          <TextField label="Имя" value={form.firstName} onChange={(v) => set('firstName', v)} maxLength={64} invalid={!form.firstName.trim()} />
          <TextField label="Фамилия" value={form.lastName} onChange={(v) => set('lastName', v)} maxLength={64} />
          <TextField label="О себе" value={form.about} onChange={(v) => set('about', v)} maxLength={initial.aboutLimit} multiline />
          <div>
            <TextField
              label="Имя пользователя"
              value={form.username}
              onChange={(v) => set('username', v.replace(/^@/, '').replace(/\s/g, ''))}
              maxLength={32}
              prefix="@"
              invalid={nameStatus === 'taken' || nameStatus === 'invalid'}
            />
            <UsernameHint status={nameStatus} username={form.username.trim()} />
          </div>
          <p className="text-subtext2 text-secondary">
            Изменения сохраняются в вашем аккаунте Telegram и видны во всех приложениях.
          </p>
        </div>
      </div>
    </>
  )
}

export function EditProfileModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const api = useApi()
  const { data, error, loading } = useAsync(() => (open ? api.getEditableProfile() : Promise.resolve(undefined)), [api, open])
  return (
    <Modal open={open} onClose={onClose} label="Изменить профиль">
      {loading || !data ? (
        <>
          <div className="flex h-[53px] items-center px-2">
            <ModalClose onClose={onClose} />
          </div>
          {error ? <p className="p-8 text-center text-body text-secondary">{errorText(error)}</p> : <Spinner className="py-20" />}
        </>
      ) : (
        <Form initial={data} onClose={onClose} onSaved={onSaved} />
      )}
    </Modal>
  )
}
