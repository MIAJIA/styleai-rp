import { cn } from "@/lib/utils"

interface IOSHeaderProps {
  title: string
  subtitle?: string
  className?: string
  center?: boolean
}

export default function IOSHeader({ title, subtitle, className, center = true }: IOSHeaderProps) {
  return (
    <div className={cn("pt-safe px-5 pb-4", className)}>
      <h1 className={cn("text-2xl font-bold text-foreground", center && "text-center")}>{title}</h1>
      {subtitle && (
        <p className={cn("text-sm text-muted-foreground mt-1 text-balance", center && "text-center")}>{subtitle}</p>
      )}
    </div>
  )
}
