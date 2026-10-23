import { useEffect, useState } from 'react'
import { useApi } from '../store'
import type { Media } from '../tg/types'

/** Demo media carry a ready URL; an animated sticker's URL is the .tgs itself, not an image. */
const directSrc = (m: Media | undefined) => (m?.src && m.mimeType !== 'application/x-tgsticker' ? m.src : null)

export function useThumb(media: Media | undefined) {
  const api = useApi()
  const [src, setSrc] = useState<string | null>(directSrc(media))
  useEffect(() => {
    let alive = true
    if (!media) return
    const direct = directSrc(media)
    if (direct) return setSrc(direct)
    setSrc(null)
    api.getMediaThumb(media).then((u) => alive && setSrc(u))
    return () => {
      alive = false
    }
  }, [api, media])
  return src
}

export function useMediaFile(media: Media | undefined, enabled = true) {
  const api = useApi()
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    setSrc(null)
    if (media && enabled) api.getMediaFile(media).then((u) => alive && setSrc(u))
    return () => {
      alive = false
    }
  }, [api, media, enabled])
  return src
}
