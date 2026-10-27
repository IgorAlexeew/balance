import { cn } from '@/shared/lib/cn'

/** Лого приложения: чёрное пятно из мазков, розовая капля краски, голубой шар */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/logo.webp"
      width={256}
      height={256}
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
