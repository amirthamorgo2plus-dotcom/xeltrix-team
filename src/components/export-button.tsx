import { Download } from "lucide-react";

export function ExportButton({
  href,
  label = "Export CSV",
}: {
  href: string;
  label?: string;
}) {
  return (
    <a
      href={href}
      download
      className="inline-flex h-9 items-center gap-2 rounded-md border border-zinc-300 bg-transparent px-3 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      <Download className="h-4 w-4" />
      {label}
    </a>
  );
}
