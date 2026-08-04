"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

/**
 * Renders one thumb per value, so the same component covers a single handle and
 * a two-handle range.
 */
export function Slider({
  className,
  value,
  thumbLabels,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Accessible name per thumb, e.g. ["From", "To"]. */
  thumbLabels?: string[];
}) {
  const thumbs = value ?? props.defaultValue ?? [0];

  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none select-none items-center py-2",
        className,
      )}
      value={value}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-muted">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary" />
      </SliderPrimitive.Track>
      {thumbs.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={thumbLabels?.[index]}
          className="block h-4 w-4 rounded-full border-2 border-primary bg-card shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
        />
      ))}
    </SliderPrimitive.Root>
  );
}
