import type { ChatFolder, Dialog } from '../tg/types'

const base = { pinned: [], include: [], exclude: [] }

export const ALL_CHATS: ChatFolder = { ...base, id: 0, title: 'Все' }
export const ARCHIVE: ChatFolder = { ...base, id: -1, title: 'Архив' }

/** Shown when the account has no folders of its own. */
export const DEFAULT_FOLDERS: ChatFolder[] = [
  ALL_CHATS,
  { ...base, id: -2, title: 'Личные', contacts: true, nonContacts: true, bots: true, excludeArchived: true },
  { ...base, id: -3, title: 'Группы', groups: true, excludeArchived: true },
  { ...base, id: -4, title: 'Каналы', channels: true, excludeArchived: true },
]

function matches(d: Dialog, f: ChatFolder) {
  const id = d.peer.id
  if (f.id === 0) return !d.archived
  if (f.id === ARCHIVE.id) return !!d.archived
  if (f.exclude.includes(id)) return false
  if (f.pinned.includes(id) || f.include.includes(id)) return true
  const p = d.peer
  const byType =
    p.kind === 'bot' ? f.bots
    : p.kind === 'user' ? (p.contact || p.isSelf ? f.contacts : f.nonContacts)
    : p.kind === 'group' ? f.groups
    : f.channels
  if (!byType) return false
  if (f.excludeMuted && d.muted && !d.unreadMentions) return false
  if (f.excludeRead && !d.unread && !d.unreadMentions) return false
  if (f.excludeArchived && d.archived) return false
  return true
}

/** Dialogs of a folder: its own pinned chats first (in order), then the rest by last message. */
export function folderDialogs(dialogs: Dialog[], f: ChatFolder): Dialog[] {
  const list = dialogs.filter((d) => matches(d, f))
  if (f.id <= 0) return list
  const pinned = f.pinned.flatMap((id) => list.find((d) => d.peer.id === id) ?? []).map((d) => ({ ...d, pinned: true }))
  const rest = list
    .filter((d) => !f.pinned.includes(d.peer.id))
    .map((d) => ({ ...d, pinned: false }))
    .sort((a, b) => (b.last?.date ?? 0) - (a.last?.date ?? 0))
  return [...pinned, ...rest]
}

/** Chats with unread messages that would show a badge (Telegram doesn't count muted ones). */
export function folderUnread(dialogs: Dialog[], f: ChatFolder) {
  return dialogs.filter((d) => matches(d, f) && (d.unreadMentions > 0 || (d.unread > 0 && !d.muted))).length
}
