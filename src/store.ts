import { create } from 'zustand'
import type { Peer, TgApi } from './tg/types'

export type Theme = 'dark' | 'light'
type Mode = 'live' | 'demo'

export const liveConfigured = !!import.meta.env.VITE_TG_API_ID && !!import.meta.env.VITE_TG_API_HASH

async function createApi(mode: Mode): Promise<TgApi> {
  if (mode === 'demo') {
    const { DemoApi } = await import('./tg/demo')
    return new DemoApi()
  }
  const { GramApi } = await import('./tg/gram')
  return new GramApi(Number(import.meta.env.VITE_TG_API_ID), String(import.meta.env.VITE_TG_API_HASH))
}

export interface ComposeTarget {
  peerId?: string
  commentTo?: number
  replyTo?: number
  title?: string
}

interface AppState {
  api: TgApi | null
  me: Peer | null
  status: 'boot' | 'auth' | 'ready'
  theme: Theme
  compose: ComposeTarget | null
  toast: string | null
  badges: { messages: number; notifications: number }
  /** Bumped when a profile photo changes so mounted avatars refetch. */
  avatarVersion: number
  refreshMe(opts?: { photoChanged?: boolean }): Promise<void>
  setBadges(b: { messages: number; notifications: number }): void
  boot(): Promise<void>
  selectMode(mode: Mode): Promise<TgApi>
  finishLogin(): Promise<void>
  logout(): Promise<void>
  setTheme(t: Theme): void
  openCompose(t?: ComposeTarget): void
  closeCompose(): void
  showToast(msg: string): void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useApp = create<AppState>((set, get) => ({
  api: null,
  me: null,
  status: 'boot',
  theme: (document.documentElement.dataset.theme as Theme) || 'dark',
  compose: null,
  toast: null,
  badges: { messages: 0, notifications: 0 },
  avatarVersion: 0,
  async refreshMe(opts) {
    const api = get().api
    if (!api) return
    const me = await api.getMe()
    set((s) => ({ me: { ...me }, avatarVersion: s.avatarVersion + (opts?.photoChanged ? 1 : 0) }))
  },
  setBadges: (badges) => set({ badges }),

  async boot() {
    const mode = (localStorage.getItem('xg:mode') as Mode | null) ?? null
    if (!mode || (mode === 'live' && !liveConfigured)) return set({ status: 'auth' })
    try {
      const api = await createApi(mode)
      set({ api })
      if (await api.isAuthorized()) {
        set({ me: await api.getMe(), status: 'ready' })
      } else set({ status: 'auth' })
    } catch (e) {
      console.error(e)
      set({ status: 'auth' })
    }
  },

  async selectMode(mode) {
    const current = get().api
    if (current?.mode === mode) return current
    const api = await createApi(mode)
    localStorage.setItem('xg:mode', mode)
    set({ api })
    return api
  },

  async finishLogin() {
    const api = get().api!
    set({ me: await api.getMe(), status: 'ready' })
  },

  async logout() {
    await get().api?.logout()
    localStorage.removeItem('xg:mode')
    set({ api: null, me: null, status: 'auth' })
  },

  setTheme(theme) {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff')
    try {
      localStorage.setItem('xg:theme', theme)
    } catch {
      /* private mode */
    }
    set({ theme })
  },

  openCompose: (t = {}) => set({ compose: t }),
  closeCompose: () => set({ compose: null }),

  showToast(msg) {
    clearTimeout(toastTimer)
    set({ toast: msg })
    toastTimer = setTimeout(() => set({ toast: null }), 3000)
  },
}))

/** Non-null api for components rendered only after login. */
export const useApi = () => useApp((s) => s.api!) as TgApi

export function errorText(e: unknown): string {
  const msg = (e as { errorMessage?: string })?.errorMessage ?? (e instanceof Error ? e.message : String(e))
  const map: Record<string, string> = {
    API_ID_INVALID: 'Неверный api_id / api_hash — проверьте .env',
    PHONE_NUMBER_INVALID: 'Неверный номер телефона',
    PHONE_CODE_INVALID: 'Неверный код',
    PHONE_CODE_EXPIRED: 'Код устарел, запросите новый',
    PASSWORD_HASH_INVALID: 'Неверный пароль',
    FLOOD: 'Слишком много попыток, подождите',
    REACTION_INVALID: 'Эта реакция недоступна в канале',
    CHAT_WRITE_FORBIDDEN: 'Нельзя писать в этот чат',
    CHAT_ADMIN_REQUIRED: 'Нужны права администратора',
  }
  for (const [k, v] of Object.entries(map)) if (msg.includes(k)) return v
  return msg
}
