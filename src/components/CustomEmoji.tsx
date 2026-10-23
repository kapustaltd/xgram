import { useEffect, useState } from 'react'
import { useApi } from '../store'
import type { Media } from '../tg/types'
import { StickerView } from './Sticker'

/** Premium custom emoji (by document id). `animate` plays it; otherwise it animates on hover. */
export function CustomEmoji({ id, size = 20, animate, title }: { id: string; size?: number; animate?: boolean; title?: string }) {
  const api = useApi()
  const [media, setMedia] = useState<Media | null>(null)
  useEffect(() => {
    let alive = true
    setMedia(null)
    api.getCustomEmoji(id).then((m) => alive && setMedia(m))
    return () => {
      alive = false
    }
  }, [api, id])
  if (!media) return <span className="inline-block shrink-0" style={{ width: size, height: size }} aria-hidden />
  return (
    <span title={title} className="inline-flex shrink-0">
      <StickerView media={media} size={size} preview={!animate} />
    </span>
  )
}
