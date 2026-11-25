import { createContext, useContext, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const SegmentContext = createContext<string | undefined>(undefined)

// A segmented control: one of a few views. Each button is a tab; the page shows the view that fits.
export function Segment({ value, className, ...props }: ComponentProps<'div'> & { value: string }) {
  return (
    <SegmentContext.Provider value={value}>
      <div role="tablist" data-slot="segment" className={cn('flex gap-1 rounded-[9px] bg-fill p-0.5', className)} {...props} />
    </SegmentContext.Provider>
  )
}

export function SegmentButton({ value, className, ...props }: ComponentProps<'button'> & { value: string }) {
  const selected = useContext(SegmentContext) === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      data-slot="segment-button"
      className={cn(
        'h-8 flex-1 rounded-[7px] text-[13px] font-medium outline-offset-2 transition-all focus-visible:outline-2 focus-visible:outline-primary',
        selected ? 'bg-muted font-semibold text-foreground shadow-[0_3px_8px_rgba(0,0,0,0.12),0_3px_1px_rgba(0,0,0,0.04)] dark:bg-[#636366]' : 'text-foreground',
        className,
      )}
      {...props}
    />
  )
}
