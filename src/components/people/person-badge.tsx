import { Badge } from "@/components/ui/table";
import { personColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function PersonBadge({
  name,
  color,
  className,
}: {
  name: string;
  color?: string | null;
  className?: string;
}) {
  const safeColor = personColor(color);

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 border", className)}
      style={{ borderColor: `${safeColor}80`, backgroundColor: `${safeColor}14` }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: safeColor }}
      />
      {name}
    </Badge>
  );
}
