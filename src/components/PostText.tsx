import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../lib/cn'
import type { TextEntity } from '../tg/types'

const LINKY = /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(@[a-zA-Z][\w]{3,31})|(#[\p{L}\p{N}_]+)/gu

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <span
      onClick={(e) => {
        e.stopPropagation()
        setShown(true)
      }}
      className={cn('rounded-xs transition', !shown && 'cursor-pointer bg-hover-subtle text-transparent blur-[5px] select-none')}
    >
      {children}
    </span>
  )
}

const stop = (e: React.MouseEvent) => e.stopPropagation()

function linkFor(kind: 'url' | 'mention' | 'hashtag', value: string, key: string, children: ReactNode, href?: string) {
  const cls = 'text-brand hover:underline'
  if (kind === 'mention') {
    return (
      <Link key={key} to={`/${value}`} onClick={stop} className={cls}>
        {children}
      </Link>
    )
  }
  if (kind === 'hashtag') {
    return (
      <Link key={key} to={`/explore?q=${encodeURIComponent(value)}`} onClick={stop} className={cls}>
        {children}
      </Link>
    )
  }
  const url = href ?? (/^https?:/i.test(value) ? value : `https://${value}`)
  return (
    <a key={key} href={url} target="_blank" rel="noopener noreferrer" onClick={stop} className={cls}>
      {children}
    </a>
  )
}

function autolink(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(LINKY)) {
    const i = m.index ?? 0
    if (i > last) out.push(text.slice(last, i))
    const kind = m[1] ? 'url' : m[2] ? 'mention' : 'hashtag'
    out.push(linkFor(kind, m[0], `${keyBase}-${i}`, kind === 'url' ? m[0].replace(/^https?:\/\/(www\.)?/, '') : m[0]))
    last = i + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function wrap(e: TextEntity, slice: string, key: string, inner: ReactNode): ReactNode {
  switch (e.type) {
    case 'bold':
      return <strong key={key} className="font-bold">{inner}</strong>
    case 'italic':
      return <em key={key}>{inner}</em>
    case 'underline':
      return <u key={key}>{inner}</u>
    case 'strike':
      return <s key={key}>{inner}</s>
    case 'code':
      return (
        <code key={key} className="rounded-xs bg-hover-subtle px-1 font-mono text-[0.9em]">
          {inner}
        </code>
      )
    case 'pre':
      return (
        <pre key={key} className="my-1 overflow-x-auto rounded-xs bg-hover-subtle p-3 font-mono text-subtext1 whitespace-pre">
          {inner}
        </pre>
      )
    case 'blockquote':
      return (
        <span key={key} className="my-1 block border-s-[3px] border-brand ps-3 text-secondary">
          {inner}
        </span>
      )
    case 'spoiler':
      return <Spoiler key={key}>{inner}</Spoiler>
    case 'url':
      return linkFor('url', slice, key, inner)
    case 'textUrl':
      return linkFor('url', slice, key, inner, e.url)
    case 'mention':
      return linkFor('mention', slice, key, inner)
    case 'mentionName':
      return (
        <Link key={key} to={`/u/${e.userId}`} onClick={stop} className="text-brand hover:underline">
          {inner}
        </Link>
      )
    case 'hashtag':
      return linkFor('hashtag', slice, key, inner)
  }
}

/** Renders Telegram message text + entities (UTF-16 offsets map directly onto JS strings). */
export function PostText({
  text,
  entities,
  className,
  clamp,
  onMore,
}: {
  text: string
  entities?: TextEntity[]
  className?: string
  /** Truncate after this many characters and show "Показать ещё". */
  clamp?: number
  onMore?: () => void
}) {
  if (!text) return null
  const truncated = clamp != null && text.length > clamp
  const shown = truncated ? text.slice(0, clamp).replace(/\s+\S*$/, '') : text
  const ents = (entities ?? []).filter((e) => e.offset < shown.length)

  const cuts = new Set([0, shown.length])
  for (const e of ents) {
    cuts.add(e.offset)
    cuts.add(Math.min(shown.length, e.offset + e.length))
  }
  const points = [...cuts].sort((a, b) => a - b)
  const nodes: ReactNode[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const [from, to] = [points[i], points[i + 1]]
    const slice = shown.slice(from, to)
    const active = ents.filter((e) => e.offset <= from && e.offset + e.length >= to)
    const hasLink = active.some((e) => ['url', 'textUrl', 'mention', 'mentionName', 'hashtag'].includes(e.type))
    let node: ReactNode = hasLink ? slice : autolink(slice, `a${from}`)
    // innermost = shortest entity
    for (const e of [...active].sort((a, b) => a.length - b.length)) {
      const full = shown.slice(e.offset, e.offset + e.length)
      node = wrap(e, full, `${e.type}${from}`, node)
    }
    nodes.push(<span key={from}>{node}</span>)
  }

  return (
    <div className={cn('text-body whitespace-pre-wrap [overflow-wrap:anywhere]', className)} dir="auto">
      {nodes}
      {truncated && (
        <>
          …{' '}
          <button
            type="button"
            className="text-brand hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              onMore?.()
            }}
          >
            Показать ещё
          </button>
        </>
      )}
    </div>
  )
}
