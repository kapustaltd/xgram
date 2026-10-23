import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { useMediaFile, useThumb } from '../lib/useMedia'
import type { Media } from '../tg/types'

/** Fires once the element scrolls near the viewport. */
function useVisible<T extends Element>(rootMargin = '200px') {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || visible) return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && setVisible(true), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [visible, rootMargin])
  return [ref, visible] as const
}

const tgsCache = new Map<string, Promise<unknown>>()

/** .tgs = gzipped Lottie JSON. */
function loadTgs(url: string) {
  let p = tgsCache.get(url)
  if (!p) {
    p = fetch(url)
      .then((r) => r.body!.pipeThrough(new DecompressionStream('gzip')))
      .then((s) => new Response(s).json())
    tgsCache.set(url, p)
  }
  return p
}

function Lottie({ url, play, className }: { url: string; play: boolean; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const anim = useRef<{ play(): void; goToAndStop(f: number, isFrame: boolean): void; destroy(): void } | null>(null)
  useEffect(() => {
    let cancelled = false
    Promise.all([import('lottie-web/build/player/lottie_light'), loadTgs(url)]).then(([mod, data]) => {
      if (cancelled || !box.current) return
      const lottie = (mod as { default: typeof import('lottie-web').default }).default
      anim.current = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: true, autoplay: false, animationData: data })
      if (play) anim.current.play()
      else anim.current.goToAndStop(0, true)
    })
    return () => {
      cancelled = true
      anim.current?.destroy()
      anim.current = null
    }
  }, [url]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!anim.current) return
    if (play) anim.current.play()
    else anim.current.goToAndStop(0, true)
  }, [play])
  return <div ref={box} className={className} />
}

/**
 * Renders a sticker: static (webp/png/svg) as <img>, video stickers (webm) as <video>,
 * animated (.tgs) through lottie. `preview` shows the cheap thumbnail until hovered.
 */
export function StickerView({ media, size = 160, preview, className }: { media: Media; size?: number; preview?: boolean; className?: string }) {
  const [ref, visible] = useVisible<HTMLDivElement>()
  const [hover, setHover] = useState(false)
  const animated = media.mimeType === 'application/x-tgsticker' || media.mimeType === 'video/webm'
  const thumb = useThumb(visible && (preview || !animated) ? media : undefined)
  const wantFile = visible && (!preview || hover || !thumb) && (animated || !thumb)
  const file = useMediaFile(media, wantFile)
  const style = { width: size, height: size }

  let body = null
  if (file && media.mimeType === 'application/x-tgsticker') body = <Lottie url={file} play={!preview || hover} className="size-full" />
  else if (file && media.mimeType === 'video/webm') body = <video src={file} autoPlay={!preview || hover} loop muted playsInline className="size-full object-contain" />
  else if (thumb || file) body = <img src={(thumb ?? file)!} alt="Стикер" draggable={false} className="size-full object-contain" />

  return (
    <div
      ref={ref}
      style={style}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn('flex shrink-0 items-center justify-center', className)}
    >
      {body ?? <div className="size-3/4 animate-pulse rounded-md bg-hover-subtle" />}
    </div>
  )
}

/** Inline GIF (Telegram GIFs are muted mp4s). */
export function GifView({ media, className, preview }: { media: Media; className?: string; preview?: boolean }) {
  const [ref, visible] = useVisible<HTMLDivElement>()
  const [hover, setHover] = useState(false)
  const thumb = useThumb(visible ? media : undefined)
  const file = useMediaFile(media, visible && (!preview || hover) && !media.src)
  return (
    <div ref={ref} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} className={cn('relative size-full bg-surface-2', className)}>
      {file && !media.src ? (
        <video src={file} autoPlay loop muted playsInline className="size-full object-cover" />
      ) : thumb ? (
        <img src={thumb} alt="GIF" className="size-full object-cover" />
      ) : (
        <div className="size-full animate-pulse bg-hover-subtle" />
      )}
    </div>
  )
}
