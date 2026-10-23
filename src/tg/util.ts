import type { Post } from './types'

/** Collapse album parts (same groupedId) into one post, like X shows a multi-image tweet. */
export function groupAlbums(posts: Post[]): Post[] {
  const out: Post[] = []
  const albums = new Map<string, Post>()
  const sorted = [...posts].sort((a, b) => a.id - b.id)
  for (const p of sorted) {
    if (!p.groupedId) {
      out.push(p)
      continue
    }
    const key = `${p.peerId}:${p.groupedId}`
    const head = albums.get(key)
    if (!head) {
      const copy = { ...p, media: [...p.media] }
      albums.set(key, copy)
      out.push(copy)
      continue
    }
    head.media.push(...p.media)
    if (!head.text && p.text) {
      head.text = p.text
      head.entities = p.entities
    }
    head.views = Math.max(head.views ?? 0, p.views ?? 0) || undefined
    head.replies = (head.replies ?? 0) + (p.replies ?? 0) || undefined
    if (!head.reactions?.length && p.reactions?.length) {
      head.reactions = p.reactions
      head.id = p.id
    }
  }
  return out.sort((a, b) => b.date - a.date)
}

/** Run `fn` over `items` with at most `limit` promises in flight. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return results
}

/** Returns a scheduler that runs at most `limit` tasks concurrently. */
export function limiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []
  const pump = () => {
    if (active >= limit || !queue.length) return
    active++
    queue.shift()!()
  }
  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--
            pump()
          })
      })
      pump()
    })
}

export function engagementScore(p: Post): number {
  const reactions = p.reactions?.reduce((s, r) => s + r.count, 0) ?? 0
  const ageHours = Math.max(1, (Date.now() - p.date) / 3_600_000)
  return ((p.views ?? 0) / 100 + reactions * 3 + (p.replies ?? 0) * 5 + (p.forwards ?? 0) * 4 + 1) / Math.pow(ageHours, 0.8)
}
