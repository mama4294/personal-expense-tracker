"use client";

import { Check } from "lucide-react";
import { PERSON_COLORS } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {PERSON_COLORS.map((color) => {
        const selected = value === color.value;
        return (
          <button
            key={color.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={color.label}
            title={color.label}
            onClick={() => onChange(color.value)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full transition-transform",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected ? "scale-110" : "hover:scale-105",
            )}
            style={{ backgroundColor: color.value }}
          >
            {/* White tick reads on every swatch in the palette. */}
            {selected ? <Check className="h-4 w-4 text-white" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function ColorDot({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
    />
  );
}
