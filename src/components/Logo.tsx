import { cn } from '../lib/cn'

/** Xgram mark: a monochrome paper plane in X's flat style (not X's logo). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-label="Xgram" className={cn('fill-current', className)}>
      <path d="M2.4 11.1 20.6 3.6c.9-.4 1.8.4 1.6 1.3l-3.1 14.6c-.2 1-1.4 1.4-2.2.8l-4.6-3.4-2.4 2.3c-.3.3-.8.1-.8-.3l.2-3.6 8-7.4c.3-.3-.1-.8-.5-.5L6.9 13.6 2.6 12.3c-.8-.3-.9-1-.2-1.2z" />
    </svg>
  )
}

export function LogoOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn('fill-none stroke-current', className)} strokeWidth={0.18} strokeLinejoin="round">
      <path d="M2.4 11.1 20.6 3.6c.9-.4 1.8.4 1.6 1.3l-3.1 14.6c-.2 1-1.4 1.4-2.2.8l-4.6-3.4-2.4 2.3c-.3.3-.8.1-.8-.3l.2-3.6 8-7.4c.3-.3-.1-.8-.5-.5L6.9 13.6 2.6 12.3c-.8-.3-.9-1-.2-1.2z" />
    </svg>
  )
}
