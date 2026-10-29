import { cn } from "@/lib/utils";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** Small square account logo; falls back to the name's initials. */
export function AccountLogo({
  name,
  logo,
  className,
}: {
  name: string;
  logo?: string | null;
  className?: string;
}) {
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- inline data URL, nothing to optimize
      <img
        src={logo}
        alt=""
        aria-hidden="true"
        className={cn("h-5 w-5 shrink-0 rounded border border-border bg-white object-contain", className)}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-border bg-muted text-[9px] font-semibold text-muted-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Logo + name on one line, for tables and lists. */
export function AccountName({
  name,
  logo,
  className,
}: {
  name: string;
  logo?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <AccountLogo name={name} logo={logo} />
      <span className="truncate">{name}</span>
    </span>
  );
}
