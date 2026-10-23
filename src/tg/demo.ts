import type { ChatFolder, Dialog, Gift, GiftPage, LoginStep, Media, Peer, Post, SearchResult, SendOptions, StickerSet, TgApi, TgEvent } from './types'
import { groupAlbums } from './util'

const ME: Peer = { id: '1000', kind: 'user', title: 'Вы', username: 'you', isSelf: true, premium: true, emojiStatus: 'demo-status-3', phone: '+7 900 000-00-00', about: 'Демо-аккаунт Xgram — Telegram в обёртке X.' }

const PEERS: Peer[] = [
  { id: '-1001', kind: 'channel', title: 'Tech Daily', username: 'techdaily', verified: true, members: 412_300, joined: true, about: 'Главные новости технологий за день. Без воды.' },
  { id: '-1002', kind: 'channel', title: 'Дизайн-заметки', username: 'design_notes', members: 58_910, joined: true, about: 'Интерфейсы, типографика, разборы продуктов.' },
  { id: '-1003', kind: 'channel', title: 'Космос сегодня', username: 'space_today', verified: true, members: 230_118, joined: true, about: 'Запуски, миссии и красивые фото из космоса.' },
  { id: '-1004', kind: 'channel', title: 'Frontend Weekly', username: 'fe_weekly', members: 31_402, joined: true, emojiStatus: 'demo-status-2', about: 'React, CSS, браузеры и всё, что рядом.' },
  { id: '-1005', kind: 'channel', title: 'Кофе и код', username: 'coffeecode', members: 12_045, joined: true, about: 'Блог разработчика. Иногда про кофе.' },
  { id: '-1006', kind: 'channel', title: 'Мемы для своих', username: 'memes4us', members: 980_400, joined: true },
  { id: '-1101', kind: 'group', title: 'Команда проекта', members: 9, joined: true },
  { id: '-1102', kind: 'group', title: 'Чат Frontend Weekly', username: 'fe_weekly_chat', members: 2_311, joined: true },
  { id: '201', kind: 'user', title: 'Анна Смирнова', username: 'anna_s', premium: true, emojiStatus: 'demo-status-1', about: 'Product designer' },
  { id: '202', kind: 'user', title: 'Дмитрий Орлов', username: 'dorlov', about: 'Backend · Go · Rust' },
  { id: '203', kind: 'user', title: 'Мария Ким', username: 'mkim', premium: true },
  { id: '204', kind: 'user', title: 'Илья', username: 'ilya_dev' },
  { id: '205', kind: 'bot', title: 'Погода Бот', username: 'weather_demo_bot', about: 'Присылаю прогноз по запросу.' },
  { id: '-1201', kind: 'channel', title: 'Природа планеты', username: 'nature_pics', members: 1_204_000, joined: false, about: 'Самые красивые места Земли.' },
  { id: '-1202', kind: 'channel', title: 'Стартапы и VC', username: 'startups_vc', members: 88_000, joined: false, about: 'Сделки, раунды, разборы.' },
  { id: '-1203', kind: 'channel', title: 'Нейросети по-русски', username: 'ai_ru', verified: true, members: 341_000, joined: false, about: 'ИИ без хайпа.' },
]

const peerMap = new Map<string, Peer>([[ME.id, ME], ...PEERS.map((p) => [p.id, p] as const)])

function art(seed: number, w = 1200, h = 675): string {
  const hues = [210, 265, 330, 25, 160, 190, 45, 290]
  const a = hues[seed % hues.length]
  const b = (a + 60 + seed * 7) % 360
  const shapes = Array.from({ length: 6 }, (_, i) => {
    const x = ((seed * 97 + i * 211) % w) | 0
    const y = ((seed * 53 + i * 137) % h) | 0
    const r = 40 + ((seed * 31 + i * 71) % 220)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsl(${(a + i * 25) % 360} 80% 70% / .35)"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${a} 70% 45%)"/><stop offset="1" stop-color="hsl(${b} 75% 30%)"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${shapes}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const now = Date.now()
const min = 60_000
let seq = 5000

function photo(peerId: string, id: number, seed: number, w = 1200, h = 675): Media {
  return { kind: 'photo', key: `${peerId}:${id}`, width: w, height: h, src: art(seed, w, h) }
}

function post(peerId: string, minutesAgo: number, text: string, extra: Partial<Post> = {}): Post {
  const id = ++seq
  return {
    peerId,
    id,
    date: now - minutesAgo * min,
    text,
    out: false,
    senderId: peerId,
    media: [],
    ...extra,
  }
}

const R = (pairs: [string, number][]) => pairs.map(([emoji, count]) => ({ emoji, count, chosen: false }))

const channelPosts: Post[] = [
  post('-1001', 6, 'Apple, Google и Microsoft договорились о едином стандарте passkeys для синхронизации между платформами. Пароли постепенно уходят в прошлое.\n\nЧто это значит для пользователей — разбор ниже 👇', {
    views: 84_200, forwards: 412, replies: 128, reactions: R([['👍', 1240], ['🔥', 530], ['🤔', 77]]),
    entities: [{ type: 'bold', offset: 0, length: 'Apple, Google и Microsoft договорились'.length }],
  }),
  post('-1003', 14, 'Новый снимок туманности Киля с телескопа «Джеймс Уэбб». Каждая светлая точка — молодая звезда.', {
    views: 132_000, forwards: 2_100, replies: 340, reactions: R([['❤️', 8_400], ['🔥', 2_100], ['😍', 900]]),
  }),
  post('-1002', 32, 'Пять правил хорошего пустого состояния (empty state):\n\n1. Объясните, почему здесь пусто\n2. Подскажите следующий шаг\n3. Одна главная кнопка\n4. Иллюстрация — по желанию\n5. Никаких «Ой! Ничего не найдено :(»\n\n#ux #design', {
    views: 12_400, forwards: 310, replies: 41, reactions: R([['👍', 640], ['❤️', 210]]),
  }),
  post('-1004', 55, 'React 20 RC: компилятор включён по умолчанию, useEffectEvent стабилен, а <Activity> наконец вышел из экспериментов. Changelog: https://react.dev/blog', {
    views: 9_800, forwards: 190, replies: 66, reactions: R([['🔥', 410], ['👍', 250], ['🤯', 40]]),
  }),
  post('-1006', 70, 'Когда сказал «это быстрый фикс на 5 минут» в пятницу в 17:55', {
    views: 410_000, forwards: 12_000, replies: 980, reactions: R([['😁', 21_000], ['💯', 3_100], ['😭', 2_200]]),
  }),
  post('-1005', 95, 'Перешёл с REST на tRPC в пет-проекте. Плюсы: типы end-to-end, минус сотня строк boilerplate. Минусы: публичный API так не выставишь. Кто пробовал — как вам?', {
    views: 3_100, forwards: 12, replies: 23, reactions: R([['👍', 88], ['🤔', 12]]),
  }),
  post('-1003', 130, 'Starship: седьмой полёт завершён успешно — ускоритель пойман башней второй раз подряд.', {
    views: 201_000, forwards: 3_900, replies: 702, reactions: R([['🚀', 12_000], ['🔥', 5_400], ['👏', 1_900]]),
  }),
  post('-1001', 180, 'Опрос: каким браузером вы пользуетесь каждый день?', { views: 51_000, replies: 211, reactions: R([['👍', 300]]) }),
  post('-1002', 260, 'Сравнение шрифтов для интерфейсов: Inter, Geist, SF Pro и IBM Plex. Слева — кегль 13, справа — 15.', {
    views: 18_900, forwards: 540, replies: 37, reactions: R([['❤️', 920], ['👍', 400]]),
  }),
  post('-1004', 400, 'Напоминание: CSS-свойство text-wrap: balance уже поддерживается всеми основными браузерами. Заголовки больше не будут висеть одним словом на последней строке.', {
    views: 7_700, forwards: 160, replies: 18, reactions: R([['👍', 380], ['🔥', 120]]),
    entities: [{ type: 'code', offset: 'Напоминание: CSS-свойство '.length, length: 'text-wrap: balance'.length }],
  }),
  post('-1006', 600, 'Мой код в 3 часа ночи vs мой код утром', { views: 380_000, forwards: 9_000, replies: 512, reactions: R([['😁', 18_000], ['🤣', 5_200]]) }),
  post('-1001', 900, 'Пользователей Telegram стало больше миллиарда. Компания отмечает рост в Азии и Латинской Америке.', {
    views: 190_000, forwards: 4_200, replies: 1_300, reactions: R([['🎉', 9_800], ['👍', 4_100]]),
  }),
]
// media
channelPosts[1].media = [photo('-1003', channelPosts[1].id, 3, 1200, 900)]
channelPosts[4].media = [photo('-1006', channelPosts[4].id, 11, 1000, 1000)]
channelPosts[6].media = [photo('-1003', channelPosts[6].id, 21), photo('-1003', channelPosts[6].id, 22)]
channelPosts[7].media = [{ kind: 'poll', key: `-1001:${channelPosts[7].id}`, pollQuestion: 'Каким браузером вы пользуетесь каждый день?', pollAnswers: [{ text: 'Chrome', voters: 18_200 }, { text: 'Safari', voters: 7_900 }, { text: 'Firefox', voters: 4_100 }, { text: 'Arc / другие', voters: 2_600 }] }]
channelPosts[8].media = [photo('-1002', channelPosts[8].id, 31), photo('-1002', channelPosts[8].id, 32), photo('-1002', channelPosts[8].id, 33), photo('-1002', channelPosts[8].id, 34)]
channelPosts[3].media = [{ kind: 'webpage', key: `-1004:${channelPosts[3].id}`, url: 'https://react.dev/blog', siteName: 'react.dev', title: 'React Blog', description: 'Announcements and updates from the React team.', width: 1200, height: 630, src: art(41, 1200, 630) }]
channelPosts[10].media = [photo('-1006', channelPosts[10].id, 51, 800, 1000)]

const comments = new Map<string, Post[]>()
comments.set(`-1001:${channelPosts[0].id}`, [
  post('-1102', 5, 'Наконец-то. Менеджеры паролей нервно курят.', { senderId: '202', reactions: R([['😁', 34]]) }),
  post('-1102', 4, 'А что с Linux? Опять забыли?', { senderId: '204', reactions: R([['👍', 12]]) }),
  post('-1102', 2, 'Уже включил на всех аккаунтах, полёт нормальный 👌', { senderId: '201' }),
])
comments.set(`-1003:${channelPosts[1].id}`, [
  post('-1102', 12, 'Обои на рабочий стол найдены.', { senderId: '203', reactions: R([['❤️', 50]]) }),
  post('-1102', 9, 'Сложно представить масштаб. Это же световые годы!', { senderId: '202' }),
])

const chats = new Map<string, Post[]>()
function chat(peerId: string, lines: [string, number, string][]) {
  chats.set(
    peerId,
    lines.map(([from, ago, text]) => post(peerId, ago, text, { senderId: from === 'me' ? ME.id : from, out: from === 'me' })),
  )
}
chat('201', [
  ['201', 300, 'Привет! Посмотрела макеты новой ленты'],
  ['201', 299, 'Отступы как у X — прям идеально 👌'],
  ['me', 280, 'Спасибо! Брал токены прямо из их CSS'],
  ['201', 12, 'Скинешь ссылку на демо?'],
])
chat('202', [
  ['me', 1440, 'Дим, MTProto через WebSocket в браузере нормально работает?'],
  ['202', 1430, 'Да, GramJS сам выбирает WS в браузере. Только useWSS включи на https'],
  ['me', 1420, 'Понял, спасибо!'],
])
chat('-1101', [
  ['203', 90, 'Созвон в 16:00, не забудьте'],
  ['204', 80, 'Буду'],
  ['202', 75, 'Я чуть опоздаю'],
  ['203', 30, '@you ты с нами?'],
])
chat('204', [['204', 2000, 'Глянь PR, когда будет минутка']])
chat('205', [['205', 5000, 'Привет! Напиши город — пришлю прогноз ☀️']])
chat(ME.id, [
  ['me', 4000, 'Идея: Telegram с интерфейсом X'],
  ['me', 3900, 'https://my.telegram.org — получить api_id'],
])
for (const p of channelPosts) {
  const list = chats.get(p.peerId) ?? []
  list.push(p)
  chats.set(p.peerId, list)
}
// a bookmarked channel post in Saved Messages
chats.get(ME.id)!.push({ ...channelPosts[2], peerId: ME.id, id: ++seq, forwardedFrom: 'Дизайн-заметки', senderId: ME.id, out: true })

const unread: Record<string, number> = { '201': 2, '-1101': 4, '-1001': 3, '-1003': 2, '-1006': 14, '204': 1 }
const mentions: Record<string, number> = { '-1101': 1 }

function emojiSticker(e: string, i: number): Media {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><text x="64" y="100" font-size="96" text-anchor="middle">${e}</text></svg>`
  return { kind: 'sticker', key: `demo-sticker:${i}`, mimeType: 'image/svg+xml', width: 512, height: 512, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` }
}
const DEMO_STICKERS = ['😎', '🔥', '🚀', '😂', '❤️', '👍', '🤔', '🎉', '🙈', '💯', '😴', '🥳'].map(emojiSticker)
// One animated (.tgs = gzipped Lottie) sticker so the lottie path is exercised in demo mode.
DEMO_STICKERS.unshift({ kind: 'sticker', key: 'demo-sticker:tgs', mimeType: 'application/x-tgsticker', width: 512, height: 512, src: 'data:application/x-tgsticker;base64,H4sIAAAAAAAC/3VSy26EMAz8F58t5FCIWn4FcUgX2EXsAk1Q2xXi32uHtIhHD3mNPeOxlQk+IYM0SqMYEGoLmSaEZoCMj35Ynl+QpSpGuIWzezDHDU3HlLIsfa5xrhodZHmBcDfPysp9+gs3HZ8KYXxClvwqfDDfWY+3nD5BL5vxhJZhohnBBkx5jCVHHxd54lqNhL/lEaX8ZPlcFUzrjzgV84yer4PAi2ZMsodN4TxONcoiiZltjJAW3G1xdothSR0w/eLzZoZqmYX0DlfLTTfjCtiLTNH3t1OM2Was6cRfcGA3qJZp+cFa8H2Ken1n9cuOHSmVIEWaXnl/SxSuEzsOXwXRehUdpYdzS+YUPR/VsQX6x4ZrD2nO7KC5CEavINfdF3bLr3l/SGox/wAQgBcD9wIAAA==' })
const DEMO_GIFS: Media[] = [5, 9, 13, 17].map((seed, i) => ({ kind: 'gif', key: `demo-gif:${i}`, width: 480, height: 270, src: art(seed, 480, 270) }))

function demoGifts(owner: string): Gift[] {
  const day = 86_400_000
  const g = (i: number, emoji: string, extra: Partial<Gift>): Gift => ({ id: `${owner}-${i}`, date: now - i * 3 * day, sticker: emojiSticker(emoji, 900 + i), ...extra })
  return [
    g(1, '🧸', {
      fromId: '201',
      unique: {
        title: 'Плюшевый мишка',
        num: 1842,
        slug: 'demo-bear-1842',
        issued: 24_310,
        total: 50_000,
        model: { name: 'Карамель', rarityPermille: 12 },
        pattern: { name: 'Звёзды', rarityPermille: 25, sticker: emojiSticker('⭐', 990) },
        backdrop: { name: 'Полночь', rarityPermille: 10, center: '#5b7cfa', edge: '#24306e', patternColor: '#9fb3ff', text: '#ffffff' },
      },
      message: 'С днём рождения! 🎉',
    }),
    g(2, '💎', {
      fromId: '202',
      unique: {
        title: 'Алмазное кольцо',
        num: 77,
        slug: 'demo-ring-77',
        issued: 3_100,
        total: 5_000,
        model: { name: 'Огранка', rarityPermille: 5 },
        pattern: { name: 'Искры', rarityPermille: 18, sticker: emojiSticker('✨', 991) },
        backdrop: { name: 'Изумруд', rarityPermille: 15, center: '#3fcf8e', edge: '#0e5a3c', patternColor: '#a9f5cf', text: '#ffffff' },
      },
    }),
    g(3, '🌹', { fromId: '203', stars: 25, convertStars: 20, message: 'Спасибо за помощь!' }),
    g(4, '🎂', { nameHidden: true, stars: 50, convertStars: 42, limited: { remains: 1_204, total: 10_000 }, canUpgrade: true, upgradeStars: 25 }),
    g(5, '🚀', { fromId: '204', stars: 100, convertStars: 85 }),
    g(6, '💐', { fromId: '201', stars: 15, convertStars: 12 }),
    g(7, '🍾', { fromId: '202', stars: 50, convertStars: 40, limited: { remains: 0, total: 3_000 } }),
  ]
}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

export class DemoApi implements TgApi {
  readonly mode = 'demo' as const
  private listeners = new Set<(ev: TgEvent) => void>()
  private ticker?: ReturnType<typeof setInterval>

  async isAuthorized() {
    return localStorage.getItem('xg:demo') === '1'
  }
  async sendCode() {
    await wait(500)
  }
  async signIn(): Promise<LoginStep> {
    await wait(500)
    localStorage.setItem('xg:demo', '1')
    return 'done'
  }
  async checkPassword() {
    localStorage.setItem('xg:demo', '1')
  }
  async qrLogin(onUrl: (url: string) => void): Promise<LoginStep> {
    onUrl('tg://login?token=demo-token-xgram')
    await new Promise(() => {})
    return 'done'
  }
  async logout() {
    localStorage.removeItem('xg:demo')
  }

  async getEditableProfile() {
    await wait(150)
    const [firstName, ...rest] = ME.title.split(' ')
    return { firstName, lastName: rest.join(' '), about: ME.about ?? '', username: ME.username ?? '', aboutLimit: ME.premium ? 140 : 70 }
  }
  async updateProfile(p: { firstName: string; lastName: string; about: string }) {
    await wait(300)
    ME.title = [p.firstName, p.lastName].filter(Boolean).join(' ')
    ME.about = p.about
  }
  async checkUsername(username: string) {
    await wait(200)
    if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username)) return 'invalid' as const
    return [...peerMap.values()].some((p) => p.username === username && !p.isSelf) ? ('taken' as const) : ('ok' as const)
  }
  async updateUsername(username: string) {
    await wait(300)
    ME.username = username || undefined
  }
  async setProfilePhoto(file: Blob | null) {
    await wait(300)
    this.myPhoto = file ? URL.createObjectURL(file) : null
    ME.hasPhoto = !!file
  }
  private myPhoto: string | null = null

  async getMe() {
    this.startTicker()
    return ME
  }
  async getPeer(peerId: string) {
    await wait(120)
    const p = peerMap.get(peerId.startsWith('@') ? [...peerMap.values()].find((x) => x.username === peerId.slice(1))?.id ?? '' : peerId)
    if (!p) throw new Error('Не найдено')
    return p
  }
  peerSync(peerId: string) {
    return peerMap.get(peerId)
  }
  async getDialogs(): Promise<Dialog[]> {
    await wait(200)
    return [...chats.entries()]
      .map(([peerId, list]) => {
        const last = [...list].sort((a, b) => b.date - a.date)[0]
        return {
          peer: peerMap.get(peerId)!,
          last,
          unread: unread[peerId] ?? 0,
          unreadMentions: mentions[peerId] ?? 0,
          pinned: peerId === ME.id,
          muted: peerId === '-1006',
          archived: peerId === '-1006',
        }
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.last?.date ?? 0) - (a.last?.date ?? 0))
  }
  async getFolders(): Promise<ChatFolder[]> {
    await wait(100)
    return [
      { id: 0, title: 'Все', pinned: [], include: [], exclude: [] },
      { id: 1, title: 'Работа', emoticon: '💼', pinned: ['-1101'], include: ['202', '204', '-1102'], exclude: [] },
      { id: 2, title: 'Новые', emoticon: '✅', pinned: [], include: [], exclude: [], contacts: true, nonContacts: true, groups: true, bots: true, excludeRead: true, excludeArchived: true },
      { id: 3, title: 'Каналы', emoticon: '📢', pinned: [], include: [], exclude: [], channels: true, excludeArchived: true },
      { id: 4, title: 'Боты', emoticon: '🤖', pinned: [], include: [], exclude: [], bots: true },
    ]
  }
  async getHistory(peerId: string) {
    await wait(200)
    return [...(chats.get(peerId) ?? [])].sort((a, b) => b.date - a.date)
  }
  async getFeed(peerIds?: string[]) {
    await wait(350)
    if (!peerIds) return groupAlbums(channelPosts)
    return groupAlbums(peerIds.filter((id) => id !== ME.id).flatMap((id) => (chats.get(id) ?? []).filter((p) => !p.service)))
  }
  async getThread(peerId: string, msgId: number) {
    await wait(200)
    const root = (chats.get(peerId) ?? []).find((p) => p.id === msgId)
    if (!root) throw new Error('Пост не найден')
    return { root, replies: comments.get(`${peerId}:${msgId}`) ?? [] }
  }
  async getMentions() {
    await wait(200)
    return (chats.get('-1101') ?? []).filter((p) => p.text.includes('@you'))
  }
  async getSaved() {
    await wait(200)
    return [...(chats.get(ME.id) ?? [])].sort((a, b) => b.date - a.date)
  }
  async getRecommendations() {
    await wait(300)
    return PEERS.filter((p) => p.kind === 'channel' && !p.joined)
  }
  async search(query: string): Promise<SearchResult> {
    await wait(250)
    const q = query.toLowerCase().trim()
    if (!q) return { peers: [], posts: [] }
    return {
      peers: [...peerMap.values()].filter((p) => p.title.toLowerCase().includes(q) || p.username?.toLowerCase().includes(q)),
      posts: [...chats.values()].flat().filter((p) => p.text.toLowerCase().includes(q)).sort((a, b) => b.date - a.date),
    }
  }

  async sendMessage(peerId: string, text: string, opts: SendOptions = {}) {
    await wait(150)
    const media: Media[] = opts.file
      ? [{ kind: opts.file.type.startsWith('image/') ? 'photo' : 'document', key: `${peerId}:${seq + 1}`, fileName: opts.file.name, size: opts.file.size, src: opts.file.type.startsWith('image/') ? URL.createObjectURL(opts.file) : undefined }]
      : []
    const p: Post = { peerId, id: ++seq, date: Date.now(), text, out: true, senderId: ME.id, media, replyToId: opts.replyTo }
    if (opts.commentTo) {
      const k = `${peerId}:${opts.commentTo}`
      comments.set(k, [...(comments.get(k) ?? []), { ...p, peerId: '-1102' }])
      const root = channelPosts.find((x) => x.id === opts.commentTo)
      if (root) root.replies = (root.replies ?? 0) + 1
      return p
    }
    chats.set(peerId, [...(chats.get(peerId) ?? []), p])
    const peer = peerMap.get(peerId)
    if (peer && (peer.kind === 'user' || peer.kind === 'bot') && !peer.isSelf) {
      setTimeout(() => this.incoming(peerId, peer.kind === 'bot' ? `Прогноз для «${text}»: +18°, переменная облачность ⛅` : 'Ок, принято 👍'), 1500)
    }
    return p
  }
  async sendReaction(peerId: string, msgId: number, emoji: string | null) {
    const p = [...(chats.get(peerId) ?? [])].find((x) => x.id === msgId)
    if (!p) return
    const list = (p.reactions ?? []).map((r) => (r.chosen ? { ...r, chosen: false, count: r.count - 1 } : r)).filter((r) => r.count > 0)
    if (emoji) {
      const hit = list.find((r) => r.emoji === emoji)
      if (hit) Object.assign(hit, { chosen: true, count: hit.count + 1 })
      else list.push({ emoji, count: 1, chosen: true })
    }
    p.reactions = list
  }
  async bookmark(peerId: string, msgId: number) {
    const p = (chats.get(peerId) ?? []).find((x) => x.id === msgId)
    if (p) chats.get(ME.id)!.push({ ...p, peerId: ME.id, id: ++seq, date: Date.now(), forwardedFrom: peerMap.get(peerId)?.title, out: true })
  }
  async markRead(peerId: string) {
    unread[peerId] = 0
    mentions[peerId] = 0
    this.emit({ type: 'read', peerId })
  }
  async join(peerId: string) {
    const p = peerMap.get(peerId)
    if (p) p.joined = true
  }
  async getCustomEmoji(documentId: string) {
    const emoji = { 'demo-status-1': '🦄', 'demo-status-2': '🔥', 'demo-status-3': '🪐' }[documentId]
    return emoji ? emojiSticker(emoji, 800 + documentId.length) : null
  }
  async getGifts(peerId: string): Promise<GiftPage> {
    await wait(300)
    const peer = peerMap.get(peerId)
    if (!peer || peer.kind === 'group' || peer.kind === 'bot') return { gifts: [], count: 0 }
    const gifts = peer.isSelf || peerId === '201' || peerId === '-1001' ? demoGifts(peerId) : demoGifts(peerId).slice(2, 4)
    return { gifts, count: gifts.length }
  }
  async getStickerSets(): Promise<StickerSet[]> {
    return [{ id: 'recent', title: 'Недавние' }, { id: 'demo', title: 'Демо-набор', count: DEMO_STICKERS.length }]
  }
  async getStickers(setId: string) {
    await wait(150)
    return setId === 'recent' ? DEMO_STICKERS.slice(0, 4) : setId === 'demo' ? DEMO_STICKERS : []
  }
  async getSavedGifs() {
    return DEMO_GIFS
  }
  async sendDocument(peerId: string, media: Media, opts: { replyTo?: number } = {}) {
    const p: Post = { peerId, id: ++seq, date: Date.now(), text: '', out: true, senderId: ME.id, media: [{ ...media, key: `${peerId}:${seq}` }], replyToId: opts.replyTo }
    chats.set(peerId, [...(chats.get(peerId) ?? []), p])
    return p
  }
  async getAvatar(peerId: string) {
    return peerId === ME.id ? this.myPhoto : null
  }
  async getMediaThumb(media: Media) {
    return media.mimeType === 'application/x-tgsticker' ? null : (media.src ?? null)
  }
  async getMediaFile(media: Media) {
    return media.src ?? null
  }
  postLink(post: Post) {
    const peer = peerMap.get(post.peerId)
    return peer?.username ? `https://t.me/${peer.username}/${post.id}` : null
  }

  subscribe(cb: (ev: TgEvent) => void) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }
  private emit(ev: TgEvent) {
    for (const l of this.listeners) l(ev)
  }
  private incoming(peerId: string, text: string, senderId = peerId) {
    const p: Post = { peerId, id: ++seq, date: Date.now(), text, out: false, senderId, media: [] }
    chats.set(peerId, [...(chats.get(peerId) ?? []), p])
    unread[peerId] = (unread[peerId] ?? 0) + 1
    this.emit({ type: 'message', post: p })
  }
  private startTicker() {
    if (this.ticker) return
    const lines: [string, string, string][] = [
      ['-1101', '203', 'Кто-нибудь видел новый дизайн?'],
      ['201', '201', 'Кстати, тёмная тема — огонь 🔥'],
      ['-1101', '202', 'Задеплоил фикс, проверьте'],
      ['203', '203', 'Привет! Как дела?'],
    ]
    let i = 0
    this.ticker = setInterval(() => {
      const [peerId, from, text] = lines[i++ % lines.length]
      if (peerId === '203' && !chats.has('203')) chats.set('203', [])
      this.incoming(peerId, text, from)
    }, 45_000)
  }
}
