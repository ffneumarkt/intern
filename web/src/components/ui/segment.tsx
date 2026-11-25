import { createContext, useContext, type ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const SegmentContext = createContext<string | undefined>(undefined)

// A segmented control: one of a few views. Each button is a tab; the page shows the view that fits.
export function Segment({ value, className, ...props }: ComponentProps<'div'> & { value: string }) {
  return (
    <SegmentContext.Provider value={value}>
      <div role="tablist" data-slot="segment" className={cn('flex gap-1 rounded-lg bg-muted p-1', className)} {...props} />
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
        'h-9 flex-1 rounded-md text-sm font-medium outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-primary',
        selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}
