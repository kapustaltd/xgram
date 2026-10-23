import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '../lib/cn'
import { IconButton } from './ui'

/** X's sticky translucent header: 53px row + optional tabs. */
export function PageHeader({
  title,
  subtitle,
  back,
  right,
  children,
  className,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  back?: boolean
  right?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const navigate = useNavigate()
  return (
    <div className={cn('sticky top-0 z-20 border-b border-divider bg-header backdrop-blur-md', className)}>
      {(title || back || right) && (
        <div className="flex h-[53px] items-center gap-6 px-4">
          {back && (
            <IconButton label="Назад" onClick={() => (history.length > 1 ? navigate(-1) : navigate('/home'))} className="-ms-2">
              <ArrowLeft />
            </IconButton>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {typeof title === 'string' ? <h1 className="truncate text-headline1 font-bold">{title}</h1> : title}
            {subtitle && <div className="truncate text-subtext2 text-secondary">{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  return (
    <div role="tablist" className="no-scrollbar flex overflow-x-auto">
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(t.id)}
            className="group/tab flex h-[53px] min-w-14 flex-1 justify-center px-4 transition-colors hover:bg-hover-subtle"
          >
            <span className={cn('relative flex items-center whitespace-nowrap text-body', active ? 'font-bold text-primary' : 'font-medium text-secondary')}>
              {t.label}
              {active && <span className="absolute inset-x-0 bottom-0 h-1 rounded-full bg-brand" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
