export type PeerKind = 'user' | 'bot' | 'group' | 'channel'

export interface Peer {
  /** Marked peer id (GramJS utils.getPeerId): users positive, chats negative, channels -100… */
  id: string
  kind: PeerKind
  title: string
  username?: string
  verified?: boolean
  premium?: boolean
  isSelf?: boolean
  hasPhoto?: boolean
  about?: string
  members?: number
  phone?: string
  /** For channels/groups: whether the current user is a participant. */
  joined?: boolean
  /** Premium emoji status: custom emoji document id. */
  emojiStatus?: string
  /** For users: in the current user's contact list. */
  contact?: boolean
}

export type EntityType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'code'
  | 'pre'
  | 'url'
  | 'textUrl'
  | 'mention'
  | 'mentionName'
  | 'hashtag'
  | 'spoiler'
  | 'blockquote'

export interface TextEntity {
  type: EntityType
  offset: number
  length: number
  url?: string
  userId?: string
}

export type MediaKind = 'photo' | 'video' | 'gif' | 'sticker' | 'document' | 'audio' | 'voice' | 'webpage' | 'poll' | 'geo'

export interface Media {
  kind: MediaKind
  /** Key used with api.getMediaThumb (peerId:msgId). */
  key: string
  width?: number
  height?: number
  duration?: number
  fileName?: string
  size?: number
  title?: string
  description?: string
  url?: string
  siteName?: string
  pollQuestion?: string
  pollAnswers?: { text: string; voters?: number }[]
  mimeType?: string
  /** Demo mode: a ready-to-use image URL. */
  src?: string
}

export interface StickerSet {
  /** Set id, or the pseudo sets 'recent' / 'faved'. */
  id: string
  title: string
  count?: number
}

export interface GiftAttribute {
  name: string
  /** Rarity in permille (‰): 15 → 1.5% */
  rarityPermille: number
}

export interface Gift {
  /** Stable key within one peer's list. */
  id: string
  date: number
  /** Animated gift sticker (for unique gifts: the model). */
  sticker?: Media
  /** Price in Telegram Stars. */
  stars?: number
  /** Stars the owner can convert this gift into. */
  convertStars?: number
  upgradeStars?: number
  limited?: { remains?: number; total?: number }
  fromId?: string
  nameHidden?: boolean
  /** Hidden from the public profile by its owner. */
  unsaved?: boolean
  canUpgrade?: boolean
  message?: string
  unique?: {
    title: string
    num: number
    slug: string
    issued: number
    total: number
    ownerName?: string
    model?: GiftAttribute
    pattern?: GiftAttribute & { sticker?: Media }
    backdrop?: GiftAttribute & { center: string; edge: string; patternColor: string; text: string }
  }
}

export interface GiftPage {
  gifts: Gift[]
  count: number
  nextOffset?: string
}

export interface Reaction {
  emoji: string
  count: number
  chosen: boolean
}

export interface Post {
  peerId: string
  id: number
  date: number
  text: string
  entities?: TextEntity[]
  out: boolean
  senderId?: string
  views?: number
  forwards?: number
  replies?: number
  reactions?: Reaction[]
  media: Media[]
  replyToId?: number
  groupedId?: string
  edited?: boolean
  forwardedFrom?: string
  /** Service message text (joined, pinned, …). */
  service?: string
}

export interface Dialog {
  peer: Peer
  last?: Post
  unread: number
  unreadMentions: number
  pinned: boolean
  muted: boolean
  /** Lives in the Archive folder. */
  archived?: boolean
}

/** Chat folder (Telegram dialog filter). id 0 is «All chats», -1 is the Archive. */
export interface ChatFolder {
  id: number
  title: string
  emoticon?: string
  /** Peer ids pinned inside the folder, in order. Always included. */
  pinned: string[]
  include: string[]
  exclude: string[]
  contacts?: boolean
  nonContacts?: boolean
  groups?: boolean
  channels?: boolean
  bots?: boolean
  excludeMuted?: boolean
  excludeRead?: boolean
  excludeArchived?: boolean
}

export interface EditableProfile {
  firstName: string
  lastName: string
  about: string
  username: string
  /** Telegram allows 140 chars of bio for Premium, 70 otherwise. */
  aboutLimit: number
}

export type UsernameCheck = 'ok' | 'taken' | 'invalid'

export interface SearchResult {
  peers: Peer[]
  posts: Post[]
}

export type LoginStep = 'done' | 'password'

export type TgEvent =
  | { type: 'message'; post: Post }
  | { type: 'read'; peerId: string }

export interface SendOptions {
  replyTo?: number
  /** Comment under a channel post (goes to the linked discussion group). */
  commentTo?: number
  file?: File
}

export interface TgApi {
  readonly mode: 'live' | 'demo'

  isAuthorized(): Promise<boolean>
  sendCode(phone: string): Promise<void>
  signIn(code: string): Promise<LoginStep>
  checkPassword(password: string): Promise<void>
  qrLogin(onUrl: (url: string) => void, signal: AbortSignal): Promise<LoginStep>
  logout(): Promise<void>

  getMe(): Promise<Peer>
  getEditableProfile(): Promise<EditableProfile>
  updateProfile(p: Pick<EditableProfile, 'firstName' | 'lastName' | 'about'>): Promise<void>
  checkUsername(username: string): Promise<UsernameCheck>
  updateUsername(username: string): Promise<void>
  /** Upload a new profile photo (square JPEG), or remove the current one with `null`. */
  setProfilePhoto(file: Blob | null): Promise<void>
  getPeer(peerId: string, full?: boolean): Promise<Peer>
  getDialogs(): Promise<Dialog[]>
  /** The user's chat folders in their order, including «All chats» (id 0). */
  getFolders(): Promise<ChatFolder[]>
  getHistory(peerId: string, opts?: { limit?: number; offsetId?: number }): Promise<Post[]>
  /** Recent posts of the given chats; by default — of all subscribed channels. */
  getFeed(peerIds?: string[]): Promise<Post[]>
  getThread(peerId: string, msgId: number): Promise<{ root: Post; replies: Post[] }>
  getMentions(): Promise<Post[]>
  getSaved(): Promise<Post[]>
  getRecommendations(): Promise<Peer[]>
  search(query: string): Promise<SearchResult>

  sendMessage(peerId: string, text: string, opts?: SendOptions): Promise<Post | null>
  sendReaction(peerId: string, msgId: number, emoji: string | null): Promise<void>
  bookmark(peerId: string, msgId: number): Promise<void>
  markRead(peerId: string): Promise<void>
  join(peerId: string): Promise<void>

  /** Star gifts shown on a user's / channel's profile. */
  getGifts(peerId: string, offset?: string): Promise<GiftPage>

  getStickerSets(): Promise<StickerSet[]>
  getStickers(setId: string): Promise<Media[]>
  getSavedGifs(): Promise<Media[]>
  /** Send an existing document (sticker / GIF) by reference. */
  sendDocument(peerId: string, media: Media, opts?: { replyTo?: number }): Promise<Post | null>

  /** Custom (premium) emoji by document id — batched, cached. */
  getCustomEmoji(documentId: string): Promise<Media | null>

  getAvatar(peerId: string): Promise<string | null>
  getMediaThumb(media: Media): Promise<string | null>
  /** Full file as a blob URL (stickers, GIFs — small documents only). */
  getMediaFile(media: Media): Promise<string | null>
  /** Peer already seen by the api (no network). */
  peerSync(peerId: string): Peer | undefined
  postLink(post: Post): string | null

  subscribe(cb: (ev: TgEvent) => void): () => void
}
