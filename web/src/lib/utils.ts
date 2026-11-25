import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Class names joined, with the later Tailwind class winning over an earlier conflicting one.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
