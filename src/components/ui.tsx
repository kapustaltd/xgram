import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../lib/cn'
import { useApp } from '../store'

type Variant = 'primary' | 'outline' | 'brand' | 'ghost' | 'secondary'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-btn-primary text-inverted hover:bg-btn-primary-hover active:bg-btn-primary-pressed',
  brand: 'bg-btn-brand text-white hover:bg-btn-brand-hover',
  outline: 'border border-normal text-primary hover:bg-btn-ghost-hover active:bg-btn-ghost-pressed',
  ghost: 'text-primary hover:bg-btn-ghost-hover active:bg-btn-ghost-pressed',
  secondary: 'bg-btn-secondary text-primary hover:bg-btn-secondary-hover',
}
const sizes: Record<Size, string> = {
  sm: 'h-8 px-4 text-subtext1',
  md: 'h-9 px-4 text-body',
  lg: 'h-[52px] px-8 text-headline2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type="button" className={cn('x-button shrink-0', variants[variant], sizes[size], className)} {...rest} />
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('x-button size-[34px] shrink-0 text-primary hover:bg-btn-ghost-hover active:bg-btn-ghost-pressed [&_svg]:size-5', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex justify-center py-8', className)}>
      <svg viewBox="0 0 32 32" className="size-[26px]" style={{ animation: 'x-spin .75s linear infinite' }}>
        <circle cx="16" cy="16" r="14" fill="none" strokeWidth="4" className="stroke-brand opacity-20" />
        <circle cx="16" cy="16" r="14" fill="none" strokeWidth="4" strokeDasharray="80" strokeDashoffset="60" className="stroke-brand" />
      </svg>
    </div>
  )
}

/** Own verified mark (scalloped badge), drawn to resemble X's without copying its asset. */
export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-label="Подтверждённый аккаунт" className={cn('size-[18px] shrink-0 text-brand', className)}>
      <path
        fill="currentColor"
        d="M12 1.6l2.3 1.7 2.8-.4 1.1 2.6 2.6 1.1-.4 2.8 1.7 2.3-1.7 2.3.4 2.8-2.6 1.1-1.1 2.6-2.8-.4L12 22.4l-2.3-1.7-2.8.4-1.1-2.6-2.6-1.1.4-2.8L1.9 12l1.7-2.3-.4-2.8 2.6-1.1 1.1-2.6 2.8.4z"
      />
      <path d="M7.8 12.3l2.8 2.8 5.6-5.8" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Telegram's chubby five-point star; corners are rounded by stroking with the fill. */
const STAR = 'M12 2.4L15.29 8.07L21.7 9.45L17.33 14.33L18 20.85L12 18.2L6 20.85L6.67 14.33L2.3 9.45L8.71 8.07Z'

/** Telegram Premium badge: rounded star with the blue → violet → pink gradient. */
export function PremiumBadge({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" aria-label="Telegram Premium" className={cn('size-[18px] shrink-0', className)}>
      <defs>
        <linearGradient id={id} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6b93ff" />
          <stop offset="0.5" stopColor="#976fff" />
          <stop offset="1" stopColor="#e46ace" />
        </linearGradient>
      </defs>
      <path d={STAR} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  )
}

/** Telegram Stars (currency) icon: gold rounded star with an inner highlight. */
export function StarsIcon({ className }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 24 24" aria-label="Stars" className={cn('inline-block size-[1em] shrink-0', className)}>
      <defs>
        <linearGradient id={id} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd951" />
          <stop offset="1" stopColor="#ffb222" />
        </linearGradient>
      </defs>
      <path d={STAR} fill={`url(#${id})`} stroke="#e58a00" strokeWidth="2.6" strokeLinejoin="round" />
      <path d={STAR} fill={`url(#${id})`} stroke={`url(#${id})`} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={STAR} fill="#fff6c8" opacity="0.55" transform="translate(12 12.6) scale(0.42) translate(-12 -12.6)" />
    </svg>
  )
}

/**
 * X's floating-label text field: 4px radius, brand border on focus, live counter
 * in the top-right corner while focused (as on x.com's "Edit profile").
 */
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoFocus,
  inputMode,
  maxLength,
  multiline,
  prefix,
  invalid,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  autoFocus?: boolean
  inputMode?: 'tel' | 'numeric' | 'text'
  maxLength?: number
  multiline?: boolean
  /** Fixed text before the value, e.g. "@" (shown once the label floats). */
  prefix?: string
  invalid?: boolean
}) {
  const [focus, setFocus] = useState(false)
  const up = focus || value.length > 0
  const common = {
    'aria-label': label,
    'aria-invalid': invalid || undefined,
    value,
    autoFocus,
    maxLength,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
  }
  return (
    <label
      className={cn(
        'relative block rounded-xs border transition-colors',
        multiline ? 'min-h-[92px]' : 'h-14',
        invalid ? 'border-x-red ring-1 ring-x-red' : focus ? 'border-brand ring-1 ring-brand' : 'border-normal',
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute start-2 transition-all',
          up ? 'top-1.5 text-subtext2' : 'top-4 text-headline2',
          invalid ? 'text-x-red' : focus ? 'text-brand' : 'text-secondary',
        )}
      >
        {label}
      </span>
      {focus && maxLength != null && (
        <span className="pointer-events-none absolute end-2 top-1.5 text-subtext2 text-secondary tabular-nums">
          {value.length} / {maxLength}
        </span>
      )}
      {multiline ? (
        <textarea
          {...common}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full resize-none bg-transparent px-2 pt-6 pb-1.5 text-headline2 outline-none"
        />
      ) : (
        <span className="absolute inset-x-0 bottom-0 flex h-9 items-center px-2 pb-1.5">
          {prefix && up && <span className="text-headline2 text-secondary">{prefix}</span>}
          <input
            {...common}
            type={type}
            inputMode={inputMode}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-headline2 outline-none"
          />
        </span>
      )}
    </label>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[400px] flex-col gap-2 px-8 py-10">
      <h2 className="text-title2 font-extrabold text-balance">{title}</h2>
      {text && <p className="text-body text-secondary">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-10 text-center">
      <p className="text-body text-secondary">Что-то пошло не так: {error.message}</p>
      {onRetry && (
        <Button variant="brand" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  children,
  className,
  label,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  label: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-center bg-overlay sm:items-start sm:pt-[5vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn('animate-x-in flex h-dvh w-full flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[90vh] sm:max-w-[600px] sm:rounded-md', className)}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ModalClose({ onClose, className }: { onClose: () => void; className?: string }) {
  return (
    <IconButton label="Закрыть" onClick={onClose} className={className}>
      <X />
    </IconButton>
  )
}

/** Anchored popup that closes on outside click / Escape. */
export function Popover({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    setTimeout(() => document.addEventListener('mousedown', onDown))
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div
      ref={ref}
      onClick={(e) => {
        e.stopPropagation()
        if ((e.target as HTMLElement).closest('button')) onClose()
      }}
      className={cn('animate-x-in absolute z-40 overflow-hidden rounded-md bg-elevated py-1 shadow-popup', className)}
    >
      {children}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, danger }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 px-4 py-3 text-left text-body font-bold hover:bg-hover-subtle [&_svg]:size-[18.75px]', danger ? 'text-x-red' : 'text-primary')}
    >
      {icon}
      {children}
    </button>
  )
}

export function Toast() {
  const toast = useApp((s) => s.toast)
  if (!toast) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center sm:bottom-8">
      <div className="animate-x-in rounded-xs bg-brand px-4 py-3 text-body text-white shadow-popup">{toast}</div>
    </div>,
    document.body,
  )
}
