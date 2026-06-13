import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
}

export function Select({ label, className, children, ...props }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </label>
      )}
      <select
        className={cn(
          'h-10 w-full rounded-lg border border-border bg-card px-3 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
