import type { ChatFolder, Dialog, Post, TgApi } from '../tg/types'
import { engagementScore } from '../tg/util'
import { folderDialogs } from './folders'

const caches = new Map<string, { api: TgApi; at: number; data: Promise<Post[]> }>()

/** Feed shared by Home and the right column (60s TTL): all channels, or the given chats. */
export function loadFeed(api: TgApi, force = false, peerIds?: string[]) {
  const key = peerIds ? [...peerIds].sort().join(',') : '*'
  const cache = caches.get(key)
  if (!force && cache && cache.api === api && Date.now() - cache.at < 60_000) return cache.data
  const data = api.getFeed(peerIds)
  caches.set(key, { api, at: Date.now(), data })
  data.catch(() => caches.delete(key))
  return data
}

/** A custom Home tab, configured with the «+» next to «Для вас / Подписки». */
export interface CustomFeed {
  id: string
  title: string
  /** Telegram folder ids to take chats from. */
  folders: number[]
  /** Chats added one by one. Always included, whatever the type filters say. */
  peers: string[]
  channels: boolean
  groups: boolean
  sort: 'top' | 'new'
  mediaOnly?: boolean
  hideForwards?: boolean
  hideMuted?: boolean
}

export const newFeed = (): CustomFeed => ({
  id: Math.random().toString(36).slice(2, 10),
  title: '',
  folders: [],
  peers: [],
  channels: true,
  groups: false,
  sort: 'new',
})

const FEEDS_KEY = 'xg:feeds'

export function loadFeeds(): CustomFeed[] {
  try {
    const raw = JSON.parse(localStorage.getItem(FEEDS_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveFeeds(feeds: CustomFeed[]) {
  try {
    localStorage.setItem(FEEDS_KEY, JSON.stringify(feeds))
  } catch {
    /* private mode — settings live until reload */
  }
}

/** Chats a custom feed reads: chats of its folders (or all chats when none picked) filtered by type, plus hand-picked ones. */
export function feedPeers(feed: CustomFeed, dialogs: Dialog[], folders: ChatFolder[]): string[] {
  const picked = folders.filter((f) => feed.folders.includes(f.id))
  const pool = picked.length ? picked.flatMap((f) => folderDialogs(dialogs, f)) : feed.peers.length ? [] : dialogs.filter((d) => !d.archived)
  const ids = new Set(
    pool
      .filter((d) => (d.peer.kind === 'channel' ? feed.channels : d.peer.kind === 'group' && feed.groups))
      .filter((d) => !(feed.hideMuted && d.muted))
      .map((d) => d.peer.id),
  )
  for (const id of feed.peers) ids.add(id)
  return [...ids]
}

export function feedPosts(feed: CustomFeed, posts: Post[]): Post[] {
  const list = posts.filter(
    (p) => !p.service && !(feed.hideForwards && p.forwardedFrom) && !(feed.mediaOnly && !p.media.some((m) => m.kind !== 'webpage')),
  )
  return feed.sort === 'top' ? list.sort((a, b) => engagementScore(b) - engagementScore(a)) : list.sort((a, b) => b.date - a.date)
}

export interface Trend {
  tag: string
  count: number
  peerId: string
}

/** "Актуальное": hashtags (or, failing that, busiest channels) across recent channel posts. */
export function trendsFrom(posts: Post[]): Trend[] {
  const tags = new Map<string, Trend>()
  for (const p of posts) {
    for (const m of p.text.matchAll(/#[\p{L}\p{N}_]{2,}/gu)) {
      const tag = m[0].toLowerCase()
      const t = tags.get(tag) ?? { tag: m[0], count: 0, peerId: p.peerId }
      t.count++
      tags.set(tag, t)
    }
  }
  return [...tags.values()].sort((a, b) => b.count - a.count).slice(0, 6)
}
