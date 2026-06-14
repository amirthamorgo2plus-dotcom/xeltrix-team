import * as React from "react";
import { cn } from "@/lib/utils";

// High-standard table primitives: consistent padding, a soft header band,
// row hover, and clean dividers. Designed to sit inside a Card's CardContent.

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="-mx-3 overflow-x-auto sm:-mx-6">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-zinc-200 bg-zinc-50/70 text-left text-[11px] uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40",
        className
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn("divide-y divide-zinc-100 dark:divide-zinc-800/80", className)}
      {...props}
    />
  );
}

export function TR({
  className,
  hover = true,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { hover?: boolean }) {
  return (
    <tr
      className={cn(
        hover && "transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/40",
        className
      )}
      {...props}
    />
  );
}

export function TH({
  className,
  right,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 font-medium first:pl-4 last:pr-4 sm:first:pl-6 sm:last:pr-6",
        right && "text-right",
        className
      )}
      {...props}
    />
  );
}

export function TD({
  className,
  right,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { right?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2.5 align-middle first:pl-4 last:pr-4 sm:first:pl-6 sm:last:pr-6",
        right && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  );
}
