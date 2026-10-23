import { Api, TelegramClient, utils } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { NewMessage, type NewMessageEvent } from 'telegram/events'
import { CustomFile } from 'telegram/client/uploads'
import bigInt from 'big-integer'
import type {
  ChatFolder,
  Dialog,
  EditableProfile,
  Gift,
  GiftPage,
  LoginStep,
  Media,
  Peer,
  Post,
  Reaction,
  SearchResult,
  SendOptions,
  StickerSet,
  UsernameCheck,
  TextEntity,
  TgApi,
  TgEvent,
} from './types'
import { groupAlbums, limiter, mapLimit } from './util'

const SESSION_KEY = 'xg:session'

type Ent = Api.TypeUser | Api.TypeChat

const ENTITY_TYPES: Record<string, TextEntity['type']> = {
  MessageEntityBold: 'bold',
  MessageEntityItalic: 'italic',
  MessageEntityUnderline: 'underline',
  MessageEntityStrike: 'strike',
  MessageEntityCode: 'code',
  MessageEntityPre: 'pre',
  MessageEntityUrl: 'url',
  MessageEntityTextUrl: 'textUrl',
  MessageEntityMention: 'mention',
  MessageEntityMentionName: 'mentionName',
  MessageEntityHashtag: 'hashtag',
  MessageEntitySpoiler: 'spoiler',
  MessageEntityBlockquote: 'blockquote',
}

const SERVICE_TEXT: Record<string, string> = {
  MessageActionChatCreate: 'создал(а) группу',
  MessageActionChannelCreate: 'Канал создан',
  MessageActionChatAddUser: 'присоединился(-ась)',
  MessageActionChatJoinedByLink: 'присоединился(-ась) по ссылке',
  MessageActionChatJoinedByRequest: 'присоединился(-ась)',
  MessageActionChatDeleteUser: 'покинул(а) группу',
  MessageActionPinMessage: 'закрепил(а) сообщение',
  MessageActionChatEditTitle: 'изменил(а) название',
  MessageActionChatEditPhoto: 'изменил(а) фото',
  MessageActionPhoneCall: 'Звонок',
  MessageActionContactSignUp: 'теперь в Telegram',
  MessageActionGroupCall: 'Видеочат',
}

const toNum = (v: unknown) => (v == null ? undefined : Number(String(v)))

function statusId(s: Api.TypeEmojiStatus | undefined): string | undefined {
  if (s instanceof Api.EmojiStatus) return !s.until || s.until * 1000 > Date.now() ? String(s.documentId) : undefined
  if (s instanceof Api.EmojiStatusCollectible) return String(s.documentId)
  return undefined
}
/** TL colors are 24-bit RGB ints. */
const rgb = (c: number) => `#${(c >>> 0 & 0xffffff).toString(16).padStart(6, '0')}`

function toB64Url(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function bufToUrl(buf: string | Buffer | undefined, type = ''): string | null {
  if (!buf || typeof buf === 'string' || !buf.length) return null
  return URL.createObjectURL(new Blob([new Uint8Array(buf)], type ? { type } : undefined))
}

/** Largest downloadable size of a photo, preferring ~800px ('x') for feed thumbnails. */
function pickPhotoSize(sizes: Api.TypePhotoSize[] | undefined, prefer = ['x', 'm', 'y', 's']) {
  if (!sizes?.length) return undefined
  const real = sizes.filter(
    (s): s is Api.PhotoSize | Api.PhotoSizeProgressive | Api.PhotoCachedSize =>
      s instanceof Api.PhotoSize || s instanceof Api.PhotoSizeProgressive || s instanceof Api.PhotoCachedSize,
  )
  for (const t of prefer) {
    const hit = real.find((s) => s.type === t)
    if (hit) return hit
  }
  return real.sort((a, b) => b.w - a.w)[0]
}

function photoDims(photo: Api.TypePhoto | undefined) {
  if (!(photo instanceof Api.Photo)) return {}
  const s = pickPhotoSize(photo.sizes, ['y', 'x', 'm'])
  return s ? { width: s.w, height: s.h } : {}
}

export class GramApi implements TgApi {
  readonly mode = 'live' as const
  private client: TelegramClient
  private creds: { apiId: number; apiHash: string }
  private connecting?: Promise<void>
  private entities = new Map<string, Ent>()
  private raw = new Map<string, Api.Message>()
  private avatars = new Map<string, Promise<string | null>>()
  private thumbs = new Map<string, Promise<string | null>>()
  private files = new Map<string, Promise<string | null>>()
  /** Documents not attached to a message we hold (stickers / GIFs from pickers), keyed "doc:<id>". */
  private docs = new Map<string, Api.Document>()
  private stickerSets = new Map<string, Api.StickerSet>()
  private stickerCache = new Map<string, Promise<Media[]>>()
  private setRequests = limiter(3)
  private customEmoji = new Map<string, Promise<Media | null>>()
  private emojiQueue = new Map<string, (m: Media | null) => void>()
  private emojiTimer?: ReturnType<typeof setTimeout>
  private listeners = new Set<(ev: TgEvent) => void>()
  private dialogsCache?: { at: number; data: Promise<Dialog[]> }
  private foldersCache?: { at: number; data: Promise<ChatFolder[]> }
  private download = limiter(4)
  private meId?: string

  private phone = ''
  private phoneCodeHash = ''
  private pwWaiter?: { res: (pw: string) => void }
  private pwOutcome?: { res: () => void; rej: (e: unknown) => void }

  constructor(apiId: number, apiHash: string) {
    this.creds = { apiId, apiHash }
    const session = new StringSession(localStorage.getItem(SESSION_KEY) ?? '')
    this.client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
      useWSS: location.protocol === 'https:',
    })
    this.client.setLogLevel('error' as never)
  }

  // ───────────────────────── connection & auth ─────────────────────────

  private connect() {
    this.connecting ??= this.client.connect().then(() => {
      this.client.addEventHandler((e: NewMessageEvent) => this.onNewMessage(e), new NewMessage({}))
    })
    return this.connecting
  }

  private saveSession() {
    localStorage.setItem(SESSION_KEY, (this.client.session as StringSession).save())
  }

  async isAuthorized() {
    if (!localStorage.getItem(SESSION_KEY)) {
      await this.connect()
      return false
    }
    await this.connect()
    return this.client.checkAuthorization()
  }

  async sendCode(phone: string) {
    await this.connect()
    this.phone = phone.replace(/[^\d+]/g, '')
    const res = await this.client.sendCode(this.creds, this.phone)
    this.phoneCodeHash = res.phoneCodeHash
  }

  async signIn(code: string): Promise<LoginStep> {
    try {
      const res = await this.client.invoke(
        new Api.auth.SignIn({ phoneNumber: this.phone, phoneCodeHash: this.phoneCodeHash, phoneCode: code.trim() }),
      )
      if (res instanceof Api.auth.AuthorizationSignUpRequired) {
        throw new Error('Этот номер не зарегистрирован в Telegram. Зарегистрируйтесь в официальном приложении.')
      }
      this.saveSession()
      return 'done'
    } catch (e) {
      if ((e as { errorMessage?: string }).errorMessage === 'SESSION_PASSWORD_NEEDED') return 'password'
      throw e
    }
  }

  async checkPassword(password: string) {
    // QR flow is parked inside GramJS waiting for the password callback.
    if (this.pwWaiter) {
      const waiter = this.pwWaiter
      this.pwWaiter = undefined
      return new Promise<void>((res, rej) => {
        this.pwOutcome = { res, rej }
        waiter.res(password)
      })
    }
    let failure: unknown
    try {
      await this.client.signInWithPassword(this.creds, {
        password: async () => password,
        onError: async (e) => {
          failure = e
          return true
        },
      })
    } catch (e) {
      throw failure ?? e
    }
    this.saveSession()
  }

  async qrLogin(onUrl: (url: string) => void, signal: AbortSignal): Promise<LoginStep> {
    await this.connect()
    return new Promise<LoginStep>((resolve, reject) => {
      this.client
        .signInUserWithQrCode(this.creds, {
          qrCode: async ({ token }) => {
            if (signal.aborted) throw new Error('ABORTED')
            onUrl(`tg://login?token=${toB64Url(token)}`)
          },
          password: async () => {
            resolve('password')
            return new Promise<string>((res) => (this.pwWaiter = { res }))
          },
          onError: async (e) => {
            if (this.pwOutcome) {
              // wrong 2FA password: report it and let GramJS ask again
              this.pwOutcome.rej(e)
              this.pwOutcome = undefined
              return false
            }
            return true
          },
        })
        .then(
          () => {
            this.saveSession()
            this.pwOutcome?.res()
            this.pwOutcome = undefined
            resolve('done')
          },
          (e) => {
            if (!signal.aborted) reject(e)
          },
        )
    })
  }

  async logout() {
    try {
      await this.client.invoke(new Api.auth.LogOut())
    } catch {
      /* session may already be dead */
    }
    localStorage.removeItem(SESSION_KEY)
    await this.client.disconnect().catch(() => {})
  }

  // ───────────────────────── mapping ─────────────────────────

  private remember(list: Iterable<Ent | undefined | null>) {
    for (const e of list) {
      if (!e) continue
      try {
        const id = String(utils.getPeerId(e))
        const known = this.entities.get(id)
        const isMin = (x: Ent) => (x instanceof Api.User || x instanceof Api.Channel) && !!x.min
        if (known && isMin(e) && !isMin(known)) continue
        this.entities.set(id, e)
      } catch {
        /* ignore empty entities */
      }
    }
  }

  private rememberFromMessages(msgs: Iterable<Api.TypeMessage>) {
    for (const m of msgs) {
      const anyM = m as unknown as { _sender?: Ent; _chat?: Ent }
      this.remember([anyM._sender, anyM._chat])
    }
  }

  private toPeer(e: Ent): Peer {
    const id = String(utils.getPeerId(e))
    if (e instanceof Api.User) {
      const title = [e.firstName, e.lastName].filter(Boolean).join(' ') || (e.deleted ? 'Удалённый аккаунт' : 'Без имени')
      return {
        id,
        kind: e.bot ? 'bot' : 'user',
        title,
        username: e.username ?? e.usernames?.find((u) => u.active)?.username,
        verified: !!e.verified,
        premium: !!e.premium,
        isSelf: !!e.self,
        hasPhoto: e.photo instanceof Api.UserProfilePhoto,
        phone: e.phone,
        emojiStatus: statusId(e.emojiStatus),
        contact: !!e.contact,
      }
    }
    if (e instanceof Api.Channel) {
      return {
        id,
        kind: e.broadcast ? 'channel' : 'group',
        title: e.title,
        username: e.username ?? e.usernames?.find((u) => u.active)?.username,
        verified: !!e.verified,
        hasPhoto: e.photo instanceof Api.ChatPhoto,
        members: e.participantsCount,
        joined: !e.left,
        emojiStatus: statusId(e.emojiStatus),
      }
    }
    if (e instanceof Api.Chat) {
      return { id, kind: 'group', title: e.title, hasPhoto: e.photo instanceof Api.ChatPhoto, members: e.participantsCount, joined: !e.left }
    }
    const title = (e as { title?: string }).title ?? 'Недоступно'
    return { id, kind: e instanceof Api.ChannelForbidden && e.broadcast ? 'channel' : 'group', title, joined: false }
  }

  peerSync(peerId: string): Peer | undefined {
    const e = this.entities.get(peerId)
    return e ? this.toPeer(e) : undefined
  }

  private docToMedia(key: string, doc: Api.Document): Media {
    const m: Media = { kind: 'document', key, size: toNum(doc.size), mimeType: doc.mimeType }
    for (const a of doc.attributes) {
      if (a instanceof Api.DocumentAttributeVideo) Object.assign(m, { kind: m.kind === 'gif' || m.kind === 'sticker' ? m.kind : 'video', width: a.w, height: a.h, duration: a.duration })
      else if (a instanceof Api.DocumentAttributeAnimated) m.kind = m.kind === 'sticker' ? 'sticker' : 'gif'
      else if (a instanceof Api.DocumentAttributeSticker) m.kind = 'sticker'
      else if (a instanceof Api.DocumentAttributeAudio) Object.assign(m, { kind: a.voice ? 'voice' : 'audio', duration: a.duration, title: [a.performer, a.title].filter(Boolean).join(' — ') || undefined })
      else if (a instanceof Api.DocumentAttributeFilename) m.fileName = a.fileName
      else if (a instanceof Api.DocumentAttributeImageSize && !m.width) Object.assign(m, { width: a.w, height: a.h })
    }
    if (doc.mimeType === 'application/x-tgsticker') m.kind = 'sticker'
    return m
  }

  private standaloneDoc(doc: Api.Document): Media {
    const key = `doc:${doc.id}`
    this.docs.set(key, doc)
    return this.docToMedia(key, doc)
  }

  /** What to pass to client.downloadMedia for a Media, plus its document if any. */
  private mediaSource(media: Media): { src: Api.Message | Api.MessageMediaDocument; doc?: Api.Document } | undefined {
    const standalone = this.docs.get(media.key)
    if (standalone) return { src: new Api.MessageMediaDocument({ document: standalone }), doc: standalone }
    const msg = this.raw.get(media.key)
    if (!msg?.media) return undefined
    const doc = msg.media instanceof Api.MessageMediaDocument && msg.media.document instanceof Api.Document ? msg.media.document : undefined
    return { src: msg, doc }
  }

  private toMedia(key: string, media: Api.TypeMessageMedia | undefined): Media[] {
    if (!media) return []
    if (media instanceof Api.MessageMediaPhoto) {
      return [{ kind: 'photo', key, ...photoDims(media.photo) }]
    }
    if (media instanceof Api.MessageMediaDocument && media.document instanceof Api.Document) {
      return [this.docToMedia(key, media.document)]
    }
    if (media instanceof Api.MessageMediaWebPage && media.webpage instanceof Api.WebPage) {
      const w = media.webpage
      return [{ kind: 'webpage', key, url: w.url, siteName: w.siteName, title: w.title, description: w.description, ...(w.photo ? photoDims(w.photo) : {}) }]
    }
    if (media instanceof Api.MessageMediaPoll) {
      const q = media.poll.question as unknown as { text?: string } | string
      const results = media.results.results ?? []
      return [
        {
          kind: 'poll',
          key,
          pollQuestion: typeof q === 'string' ? q : (q.text ?? ''),
          pollAnswers: media.poll.answers.map((a) => {
            const t = a.text as unknown as { text?: string } | string
            const r = results.find((x) => Buffer.compare(Buffer.from(x.option), Buffer.from(a.option)) === 0)
            return { text: typeof t === 'string' ? t : (t.text ?? ''), voters: r?.voters }
          }),
        },
      ]
    }
    if (media instanceof Api.MessageMediaGeo || media instanceof Api.MessageMediaVenue) return [{ kind: 'geo', key, title: (media as Api.MessageMediaVenue).title }]
    return []
  }

  private toPost(m: Api.TypeMessage): Post | null {
    if (m instanceof Api.MessageEmpty) return null
    const peerId = String(utils.getPeerId(m.peerId))
    const key = `${peerId}:${m.id}`
    const senderId = m.fromId ? String(utils.getPeerId(m.fromId)) : m.out ? this.meId : peerId
    if (m instanceof Api.MessageService) {
      const name = SERVICE_TEXT[m.action.className] ?? 'Служебное сообщение'
      return { peerId, id: m.id, date: m.date * 1000, text: '', out: !!m.out, senderId, media: [], service: name }
    }
    this.raw.set(key, m)
    const reactions: Reaction[] | undefined = m.reactions?.results.map((r) => ({
      emoji: r.reaction instanceof Api.ReactionEmoji ? r.reaction.emoticon : r.reaction instanceof Api.ReactionPaid ? '⭐' : '💟',
      count: r.count,
      chosen: r.chosenOrder != null,
    }))
    let forwardedFrom: string | undefined
    if (m.fwdFrom) {
      forwardedFrom = m.fwdFrom.fromName
      if (!forwardedFrom && m.fwdFrom.fromId) forwardedFrom = this.peerSync(String(utils.getPeerId(m.fwdFrom.fromId)))?.title
      forwardedFrom ??= 'Скрытый источник'
    }
    return {
      peerId,
      id: m.id,
      date: m.date * 1000,
      text: m.message ?? '',
      entities: m.entities
        ?.map((e) => ({
          type: ENTITY_TYPES[e.className],
          offset: e.offset,
          length: e.length,
          url: e instanceof Api.MessageEntityTextUrl ? e.url : undefined,
          userId: e instanceof Api.MessageEntityMentionName ? String(e.userId) : undefined,
        }))
        .filter((e) => e.type),
      out: !!m.out,
      senderId,
      views: m.views,
      forwards: m.forwards,
      replies: m.replies?.replies,
      reactions,
      media: this.toMedia(key, m.media),
      replyToId: m.replyTo instanceof Api.MessageReplyHeader ? m.replyTo.replyToMsgId : undefined,
      groupedId: m.groupedId ? String(m.groupedId) : undefined,
      edited: !!m.editDate && !m.editHide,
      forwardedFrom,
    }
  }

  private posts(msgs: Iterable<Api.TypeMessage>): Post[] {
    const list = [...msgs]
    this.rememberFromMessages(list)
    return list.map((m) => this.toPost(m)).filter((p): p is Post => !!p)
  }

  private async need(peerId: string): Promise<Ent> {
    const known = this.entities.get(peerId)
    if (known) return known
    await this.connect()
    const ent = (await this.client.getEntity(peerId.startsWith('@') ? peerId.slice(1) : bigInt(peerId))) as Ent
    this.remember([ent])
    return ent
  }

  // ───────────────────────── reads ─────────────────────────

  async getMe() {
    await this.connect()
    const me = await this.client.getMe()
    this.remember([me])
    this.meId = String(utils.getPeerId(me))
    return this.toPeer(me)
  }

  async getEditableProfile(): Promise<EditableProfile> {
    await this.connect()
    const me = await this.client.getMe()
    this.remember([me])
    const full = await this.client.invoke(new Api.users.GetFullUser({ id: new Api.InputUserSelf() }))
    return {
      firstName: me.firstName ?? '',
      lastName: me.lastName ?? '',
      about: full.fullUser.about ?? '',
      username: me.username ?? me.usernames?.find((u) => u.active)?.username ?? '',
      aboutLimit: me.premium ? 140 : 70,
    }
  }

  async updateProfile(p: Pick<EditableProfile, 'firstName' | 'lastName' | 'about'>) {
    await this.connect()
    const user = await this.client.invoke(new Api.account.UpdateProfile({ firstName: p.firstName, lastName: p.lastName, about: p.about }))
    this.remember([user])
  }

  async checkUsername(username: string): Promise<UsernameCheck> {
    await this.connect()
    try {
      return (await this.client.invoke(new Api.account.CheckUsername({ username }))) ? 'ok' : 'taken'
    } catch (e) {
      const msg = (e as { errorMessage?: string }).errorMessage ?? ''
      if (msg === 'USERNAME_OCCUPIED' || msg === 'USERNAME_PURCHASE_AVAILABLE') return 'taken'
      if (msg === 'USERNAME_INVALID') return 'invalid'
      throw e
    }
  }

  async updateUsername(username: string) {
    await this.connect()
    const user = await this.client.invoke(new Api.account.UpdateUsername({ username }))
    this.remember([user])
  }

  async setProfilePhoto(file: Blob | null) {
    await this.connect()
    if (!file) {
      await this.client.invoke(new Api.photos.UpdateProfilePhoto({ id: new Api.InputPhotoEmpty() }))
    } else {
      const buf = Buffer.from(await file.arrayBuffer())
      const uploaded = await this.client.uploadFile({ file: new CustomFile('avatar.jpg', buf.length, '', buf), workers: 1 })
      const r = await this.client.invoke(new Api.photos.UploadProfilePhoto({ file: uploaded }))
      this.remember(r.users)
    }
    // refresh our own entity so the avatar cache key (photo id) changes
    this.remember([await this.client.getMe()])
  }

  async getPeer(peerId: string, full = false) {
    const ent = await this.need(peerId)
    const peer = this.toPeer(ent)
    if (!full) return peer
    try {
      if (ent instanceof Api.User) {
        const r = await this.client.invoke(new Api.users.GetFullUser({ id: ent }))
        peer.about = r.fullUser.about
      } else if (ent instanceof Api.Channel) {
        const r = await this.client.invoke(new Api.channels.GetFullChannel({ channel: ent }))
        this.remember(r.chats)
        if (r.fullChat instanceof Api.ChannelFull) {
          peer.about = r.fullChat.about
          peer.members = r.fullChat.participantsCount ?? peer.members
        }
      } else if (ent instanceof Api.Chat) {
        const r = await this.client.invoke(new Api.messages.GetFullChat({ chatId: ent.id }))
        peer.about = r.fullChat.about
      }
    } catch {
      /* full info is optional */
    }
    return peer
  }

  getDialogs(): Promise<Dialog[]> {
    if (this.dialogsCache && Date.now() - this.dialogsCache.at < 15_000) return this.dialogsCache.data
    const data = (async () => {
      await this.connect()
      const list = await this.client.getDialogs({ limit: 120 })
      this.remember(list.map((d) => d.entity))
      this.rememberFromMessages(list.map((d) => d.message).filter((m): m is Api.Message => !!m))
      return list
        .filter((d) => d.entity)
        .map((d) => {
          const settings = (d.dialog as Api.Dialog).notifySettings
          return {
            peer: this.toPeer(d.entity as Ent),
            last: d.message ? (this.toPost(d.message) ?? undefined) : undefined,
            unread: d.unreadCount,
            unreadMentions: d.unreadMentionsCount,
            pinned: d.pinned,
            muted: !!settings?.muteUntil && settings.muteUntil * 1000 > Date.now(),
            archived: d.archived,
          }
        })
    })()
    this.dialogsCache = { at: Date.now(), data }
    data.catch(() => (this.dialogsCache = undefined))
    return data
  }

  getFolders(): Promise<ChatFolder[]> {
    if (this.foldersCache && Date.now() - this.foldersCache.at < 60_000) return this.foldersCache.data
    const data = (async () => {
      await this.connect()
      const r = await this.client.invoke(new Api.messages.GetDialogFilters())
      const ids = (list: Api.TypeInputPeer[]) =>
        list.flatMap((p) => {
          if (p instanceof Api.InputPeerSelf) return this.meId ? [this.meId] : []
          try {
            return [String(utils.getPeerId(p))]
          } catch {
            return []
          }
        })
      const folders: ChatFolder[] = []
      for (const f of r.filters) {
        if (f instanceof Api.DialogFilterDefault) {
          folders.push({ id: 0, title: 'Все', pinned: [], include: [], exclude: [] })
          continue
        }
        const title = typeof f.title === 'string' ? f.title : f.title.text
        const common = { id: f.id, title, emoticon: f.emoticon, pinned: ids(f.pinnedPeers), include: ids(f.includePeers) }
        if (f instanceof Api.DialogFilterChatlist) {
          folders.push({ ...common, exclude: [] })
          continue
        }
        folders.push({
          ...common,
          exclude: ids(f.excludePeers),
          contacts: f.contacts,
          nonContacts: f.nonContacts,
          groups: f.groups,
          channels: f.broadcasts,
          bots: f.bots,
          excludeMuted: f.excludeMuted,
          excludeRead: f.excludeRead,
          excludeArchived: f.excludeArchived,
        })
      }
      // Without Premium «All chats» can't be moved and the server may omit it.
      if (!folders.some((f) => f.id === 0)) folders.unshift({ id: 0, title: 'Все', pinned: [], include: [], exclude: [] })
      return folders
    })()
    this.foldersCache = { at: Date.now(), data }
    data.catch(() => (this.foldersCache = undefined))
    return data
  }

  async getHistory(peerId: string, opts: { limit?: number; offsetId?: number } = {}) {
    const ent = await this.need(peerId)
    const msgs = await this.client.getMessages(ent, { limit: opts.limit ?? 40, offsetId: opts.offsetId ?? 0 })
    return this.posts(msgs)
  }

  async getFeed(peerIds?: string[]) {
    const dialogs = await this.getDialogs()
    const wanted = peerIds && new Set(peerIds)
    const channels = dialogs
      .filter((d) => (wanted ? wanted.has(d.peer.id) : d.peer.kind === 'channel'))
      .sort((a, b) => (b.last?.date ?? 0) - (a.last?.date ?? 0))
      .slice(0, 24)
    const chunks = await mapLimit(channels, 4, (d) => this.getHistory(d.peer.id, { limit: 10 }).catch(() => [] as Post[]))
    return groupAlbums(chunks.flat().filter((p) => !p.service))
  }

  async getThread(peerId: string, msgId: number) {
    const ent = await this.need(peerId)
    const [rootMsg] = await this.client.getMessages(ent, { ids: msgId })
    const root = rootMsg ? this.posts([rootMsg])[0] : undefined
    if (!root) throw new Error('Пост не найден')
    let replies: Post[] = []
    try {
      const msgs = await this.client.getMessages(ent, { replyTo: msgId, limit: 60 })
      replies = groupAlbums(this.posts(msgs)).reverse()
    } catch {
      /* comments disabled or not a thread */
    }
    return { root, replies }
  }

  async getMentions() {
    await this.connect()
    const out: Post[] = []
    const dialogs = await this.getDialogs()
    const withMentions = dialogs.filter((d) => d.unreadMentions > 0).slice(0, 10)
    await mapLimit(withMentions, 3, async (d) => {
      try {
        const ent = await this.need(d.peer.id)
        const r = await this.client.invoke(
          new Api.messages.GetUnreadMentions({ peer: ent, offsetId: 0, addOffset: 0, limit: 20, maxId: 0, minId: 0 }),
        )
        if ('users' in r) this.remember([...r.users, ...r.chats])
        if ('messages' in r) out.push(...this.posts(r.messages))
      } catch {
        /* skip */
      }
    })
    try {
      const r = await this.client.invoke(
        new Api.messages.Search({
          peer: new Api.InputPeerEmpty(),
          q: '',
          filter: new Api.InputMessagesFilterMyMentions(),
          minDate: 0,
          maxDate: 0,
          offsetId: 0,
          addOffset: 0,
          limit: 40,
          maxId: 0,
          minId: 0,
          hash: bigInt.zero,
        }),
      )
      if ('users' in r) this.remember([...r.users, ...r.chats])
      if ('messages' in r) out.push(...this.posts(r.messages))
    } catch {
      /* global mention search is best-effort */
    }
    const seen = new Set<string>()
    return out
      .filter((p) => {
        const k = `${p.peerId}:${p.id}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .sort((a, b) => b.date - a.date)
  }

  async getSaved() {
    await this.connect()
    const msgs = await this.client.getMessages('me', { limit: 50 })
    return groupAlbums(this.posts(msgs))
  }

  async getRecommendations() {
    await this.connect()
    try {
      const r = await this.client.invoke(new Api.channels.GetChannelRecommendations({}))
      this.remember(r.chats)
      return r.chats.filter((c) => c instanceof Api.Channel).map((c) => this.toPeer(c))
    } catch {
      return []
    }
  }

  async search(query: string): Promise<SearchResult> {
    await this.connect()
    const q = query.trim()
    if (!q) return { peers: [], posts: [] }
    const [peersRes, postsRes] = await Promise.allSettled([
      this.client.invoke(new Api.contacts.Search({ q, limit: 20 })),
      this.client.invoke(
        new Api.messages.SearchGlobal({
          q,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: 0,
          maxDate: 0,
          offsetRate: 0,
          offsetPeer: new Api.InputPeerEmpty(),
          offsetId: 0,
          limit: 30,
        }),
      ),
    ])
    const peers: Peer[] = []
    if (peersRes.status === 'fulfilled') {
      const r = peersRes.value
      this.remember([...r.users, ...r.chats])
      for (const p of [...r.myResults, ...r.results]) {
        const peer = this.peerSync(String(utils.getPeerId(p)))
        if (peer && !peers.some((x) => x.id === peer.id)) peers.push(peer)
      }
    }
    let posts: Post[] = []
    if (postsRes.status === 'fulfilled' && 'messages' in postsRes.value) {
      const r = postsRes.value as Api.messages.Messages
      this.remember([...r.users, ...r.chats])
      posts = groupAlbums(this.posts(r.messages))
    }
    return { peers, posts }
  }

  // ───────────────────────── writes ─────────────────────────

  async sendMessage(peerId: string, text: string, opts: SendOptions = {}) {
    const ent = await this.need(peerId)
    let msg: Api.Message
    if (opts.file) {
      const buf = Buffer.from(await opts.file.arrayBuffer())
      msg = await this.client.sendFile(ent, {
        file: new CustomFile(opts.file.name, opts.file.size, '', buf),
        caption: text,
        replyTo: opts.replyTo,
        commentTo: opts.commentTo,
        workers: 2,
      })
    } else {
      msg = await this.client.sendMessage(ent, { message: text, replyTo: opts.replyTo, commentTo: opts.commentTo })
    }
    this.dialogsCache = undefined
    return msg ? (this.posts([msg])[0] ?? null) : null
  }

  async sendReaction(peerId: string, msgId: number, emoji: string | null) {
    const ent = await this.need(peerId)
    await this.client.invoke(
      new Api.messages.SendReaction({ peer: ent, msgId, reaction: emoji ? [new Api.ReactionEmoji({ emoticon: emoji })] : [] }),
    )
  }

  async bookmark(peerId: string, msgId: number) {
    const ent = await this.need(peerId)
    await this.client.forwardMessages('me', { messages: [msgId], fromPeer: ent })
  }

  async markRead(peerId: string) {
    const ent = await this.need(peerId)
    await this.client.markAsRead(ent).catch(() => {})
    this.dialogsCache = undefined
    this.emit({ type: 'read', peerId })
  }

  async join(peerId: string) {
    const ent = await this.need(peerId)
    await this.client.invoke(new Api.channels.JoinChannel({ channel: ent }))
    this.dialogsCache = undefined
  }

  // ───────────────────────── files ─────────────────────────

  getAvatar(peerId: string): Promise<string | null> {
    const ent = this.entities.get(peerId)
    const photo = (ent as { photo?: Api.TypeUserProfilePhoto | Api.TypeChatPhoto } | undefined)?.photo
    if (!ent || !(photo instanceof Api.UserProfilePhoto || photo instanceof Api.ChatPhoto)) return Promise.resolve(null)
    const cacheKey = `${peerId}:${photo.photoId}`
    let p = this.avatars.get(cacheKey)
    if (!p) {
      p = this.download(async () => {
        try {
          return bufToUrl(await this.client.downloadProfilePhoto(ent, { isBig: false }), 'image/jpeg')
        } catch (e) {
          console.warn('[xgram] avatar via profile photo failed', peerId, e)
          if (!(ent instanceof Api.User)) throw e
          // Fallback: fetch the photo object itself and download its small size.
          const r = await this.client.invoke(new Api.photos.GetUserPhotos({ userId: ent, offset: 0, maxId: bigInt.zero, limit: 1 }))
          const ph = r.photos[0]
          if (!(ph instanceof Api.Photo)) return null
          return bufToUrl(await this.client.downloadMedia(new Api.MessageMediaPhoto({ photo: ph }), { thumb: pickPhotoSize(ph.sizes, ['a', 's', 'm']) }), 'image/jpeg')
        }
      }).catch((e) => {
        console.warn('[xgram] avatar failed', peerId, e)
        setTimeout(() => this.avatars.delete(cacheKey), 30_000) // allow a retry later
        return null
      })
      this.avatars.set(cacheKey, p)
    }
    return p
  }

  getMediaThumb(media: Media) {
    const cacheKey = `${media.key}:${media.kind}`
    let p = this.thumbs.get(cacheKey)
    if (!p) {
      p = this.download(async () => {
        const source = this.mediaSource(media)
        if (!source) return null
        if (source.doc) {
          const doc = source.doc
          // Static stickers are tiny: fetch the file itself; otherwise the best thumbnail.
          if (media.kind === 'sticker' && doc.mimeType === 'image/webp') return bufToUrl(await this.client.downloadMedia(source.src, {}), 'image/webp')
          const thumb = pickPhotoSize(doc.thumbs, ['m', 'x', 's'])
          if (!thumb) return null
          return bufToUrl(await this.client.downloadMedia(source.src, { thumb }))
        }
        const msg = source.src as Api.Message
        const m = msg.media
        if (m instanceof Api.MessageMediaWebPage) {
          if (!(m.webpage instanceof Api.WebPage) || !(m.webpage.photo instanceof Api.Photo)) return null
          const size = pickPhotoSize(m.webpage.photo.sizes)
          return bufToUrl(await this.client.downloadMedia(new Api.MessageMediaPhoto({ photo: m.webpage.photo }), { thumb: size }), 'image/jpeg')
        }
        if (m instanceof Api.MessageMediaPhoto && m.photo instanceof Api.Photo) {
          return bufToUrl(await this.client.downloadMedia(msg, { thumb: pickPhotoSize(m.photo.sizes) }), 'image/jpeg')
        }
        return null
      }).catch(() => null)
      this.thumbs.set(cacheKey, p)
    }
    return p
  }

  getMediaFile(media: Media) {
    let p = this.files.get(media.key)
    if (!p) {
      p = this.download(async () => {
        const source = this.mediaSource(media)
        if (!source?.doc || toNum(source.doc.size)! > 8 * 1024 * 1024) return null
        return bufToUrl(await this.client.downloadMedia(source.src, {}), source.doc.mimeType)
      }).catch((e) => {
        console.warn('[xgram] file download failed', media.key, e)
        return null
      })
      this.files.set(media.key, p)
    }
    return p
  }

  // ───────────────────────── custom emoji ─────────────────────────

  getCustomEmoji(documentId: string) {
    let p = this.customEmoji.get(documentId)
    if (!p) {
      p = new Promise<Media | null>((resolve) => this.emojiQueue.set(documentId, resolve))
      this.customEmoji.set(documentId, p)
      // Collect ids requested in the same tick into one getCustomEmojiDocuments call.
      this.emojiTimer ??= setTimeout(() => this.flushCustomEmoji(), 30)
    }
    return p
  }

  private async flushCustomEmoji() {
    this.emojiTimer = undefined
    const batch = [...this.emojiQueue.entries()].slice(0, 200)
    for (const [id] of batch) this.emojiQueue.delete(id)
    if (this.emojiQueue.size) this.emojiTimer = setTimeout(() => this.flushCustomEmoji(), 30)
    try {
      await this.connect()
      const docs = await this.client.invoke(new Api.messages.GetCustomEmojiDocuments({ documentId: batch.map(([id]) => bigInt(id)) }))
      const byId = new Map(docs.filter((d): d is Api.Document => d instanceof Api.Document).map((d) => [String(d.id), d]))
      for (const [id, resolve] of batch) {
        const d = byId.get(id)
        resolve(d ? { ...this.standaloneDoc(d), kind: 'sticker' } : null)
      }
    } catch (e) {
      console.warn('[xgram] custom emoji failed', e)
      for (const [id, resolve] of batch) {
        this.customEmoji.delete(id)
        resolve(null)
      }
    }
  }

  // ───────────────────────── gifts ─────────────────────────

  private toGift(sg: Api.SavedStarGift, i: number): Gift {
    const base: Gift = {
      id: sg.savedId ? `s${sg.savedId}` : sg.msgId ? `m${sg.msgId}` : `${sg.date}-${i}`,
      date: sg.date * 1000,
      fromId: sg.fromId ? String(utils.getPeerId(sg.fromId)) : undefined,
      nameHidden: !!sg.nameHidden,
      unsaved: !!sg.unsaved,
      canUpgrade: !!sg.canUpgrade,
      convertStars: toNum(sg.convertStars),
      upgradeStars: toNum(sg.upgradeStars),
      message: sg.message?.text,
    }
    const g = sg.gift
    if (g instanceof Api.StarGift) {
      return {
        ...base,
        sticker: g.sticker instanceof Api.Document ? this.standaloneDoc(g.sticker) : undefined,
        stars: toNum(g.stars),
        convertStars: base.convertStars ?? toNum(g.convertStars),
        upgradeStars: base.upgradeStars ?? toNum(g.upgradeStars),
        limited: g.limited ? { remains: g.availabilityRemains, total: g.availabilityTotal } : undefined,
      }
    }
    if (g instanceof Api.StarGiftUnique) {
      const unique: NonNullable<Gift['unique']> = {
        title: g.title,
        num: g.num,
        slug: g.slug,
        issued: g.availabilityIssued,
        total: g.availabilityTotal,
        ownerName: g.ownerName,
      }
      let sticker: Media | undefined
      for (const a of g.attributes) {
        if (a instanceof Api.StarGiftAttributeModel) {
          unique.model = { name: a.name, rarityPermille: a.rarityPermille }
          if (a.document instanceof Api.Document) sticker = this.standaloneDoc(a.document)
        } else if (a instanceof Api.StarGiftAttributePattern) {
          unique.pattern = { name: a.name, rarityPermille: a.rarityPermille, sticker: a.document instanceof Api.Document ? this.standaloneDoc(a.document) : undefined }
        } else if (a instanceof Api.StarGiftAttributeBackdrop) {
          unique.backdrop = { name: a.name, rarityPermille: a.rarityPermille, center: rgb(a.centerColor), edge: rgb(a.edgeColor), patternColor: rgb(a.patternColor), text: rgb(a.textColor) }
        }
      }
      return { ...base, sticker, unique }
    }
    return base
  }

  async getGifts(peerId: string, offset = ''): Promise<GiftPage> {
    const ent = await this.need(peerId)
    const r = await this.client.invoke(new Api.payments.GetSavedStarGifts({ peer: ent, offset, limit: 48 }))
    this.remember([...r.users, ...r.chats])
    return { gifts: r.gifts.map((g, i) => this.toGift(g, i)), count: r.count, nextOffset: r.nextOffset || undefined }
  }

  // ───────────────────────── stickers & GIFs ─────────────────────────

  async getStickerSets(): Promise<StickerSet[]> {
    await this.connect()
    const r = await this.client.invoke(new Api.messages.GetAllStickers({ hash: bigInt.zero }))
    const sets: StickerSet[] = [
      { id: 'recent', title: 'Недавние' },
      { id: 'faved', title: 'Избранные' },
    ]
    if (r instanceof Api.messages.AllStickers) {
      for (const s of r.sets) {
        this.stickerSets.set(String(s.id), s)
        sets.push({ id: String(s.id), title: s.title, count: s.count })
      }
    }
    return sets
  }

  getStickers(setId: string): Promise<Media[]> {
    let p = this.stickerCache.get(setId)
    if (!p) {
      p = this.setRequests(async () => {
        await this.connect()
        let docs: Api.TypeDocument[] = []
        if (setId === 'recent') {
          const r = await this.client.invoke(new Api.messages.GetRecentStickers({ hash: bigInt.zero }))
          if (r instanceof Api.messages.RecentStickers) docs = r.stickers
        } else if (setId === 'faved') {
          const r = await this.client.invoke(new Api.messages.GetFavedStickers({ hash: bigInt.zero }))
          if (r instanceof Api.messages.FavedStickers) docs = r.stickers
        } else {
          const set = this.stickerSets.get(setId)
          if (!set) return []
          const r = await this.client.invoke(
            new Api.messages.GetStickerSet({ stickerset: new Api.InputStickerSetID({ id: set.id, accessHash: set.accessHash }), hash: 0 }),
          )
          if (r instanceof Api.messages.StickerSet) docs = r.documents
        }
        return docs.filter((d): d is Api.Document => d instanceof Api.Document).map((d) => this.standaloneDoc(d))
      })
      p.catch(() => this.stickerCache.delete(setId))
      this.stickerCache.set(setId, p)
    }
    return p
  }

  async getSavedGifs() {
    await this.connect()
    const r = await this.client.invoke(new Api.messages.GetSavedGifs({ hash: bigInt.zero }))
    if (!(r instanceof Api.messages.SavedGifs)) return []
    return r.gifs.filter((d): d is Api.Document => d instanceof Api.Document).map((d) => this.standaloneDoc(d))
  }

  async sendDocument(peerId: string, media: Media, opts: { replyTo?: number } = {}) {
    const ent = await this.need(peerId)
    const doc = this.mediaSource(media)?.doc
    if (!doc) throw new Error('Документ недоступен')
    const msg = await this.client.sendFile(ent, { file: doc, replyTo: opts.replyTo })
    this.dialogsCache = undefined
    return msg ? (this.posts([msg])[0] ?? null) : null
  }

  postLink(post: Post) {
    const peer = this.peerSync(post.peerId)
    if (!peer || (peer.kind !== 'channel' && peer.kind !== 'group')) return null
    if (peer.username) return `https://t.me/${peer.username}/${post.id}`
    return `https://t.me/c/${peer.id.replace(/^-100/, '')}/${post.id}`
  }

  // ───────────────────────── updates ─────────────────────────

  subscribe(cb: (ev: TgEvent) => void) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }

  private emit(ev: TgEvent) {
    for (const l of this.listeners) l(ev)
  }

  private async onNewMessage(e: NewMessageEvent) {
    const m = e.message
    try {
      if (!(m as unknown as { _chat?: Ent })._chat) await m.getChat()
      if (!(m as unknown as { _sender?: Ent })._sender) await m.getSender()
    } catch {
      /* entity fetch is best-effort */
    }
    const [post] = this.posts([m])
    this.dialogsCache = undefined
    if (post) this.emit({ type: 'message', post })
  }
}
