import { cn } from '@/shared/lib/cn'

/** Иконка приложения B-black: розовый поток рисует «Б», голубой шар — чаша */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/favicon.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        'size-10 shrink-0 rounded-[30%] shadow-[0_12px_24px_-12px_rgb(17_19_24/0.45)]',
        className,
      )}
    />
  )
}
