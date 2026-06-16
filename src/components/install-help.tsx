import { Smartphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Permanent, always-available install instructions (native <details> so it
// needs no client JS). Shown on Profile and Attendance so staff can find it
// even after dismissing the one-time install banner.
export function InstallHelp() {
  return (
    <Card>
      <CardContent className="p-0">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-medium">
            <Smartphone className="h-4 w-4 text-emerald-600" />
            Install this app on your phone
            <span className="ml-auto text-xs text-zinc-400 group-open:hidden">Show</span>
            <span className="ml-auto hidden text-xs text-zinc-400 group-open:inline">Hide</span>
          </summary>
          <div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium">iPhone / iPad (Safari)</div>
              <ol className="mt-1 list-decimal pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                <li>Open this site in <strong>Safari</strong>.</li>
                <li>
                  Tap the <strong>Share</strong> button (the square with an up-arrow).
                </li>
                <li>
                  Choose <strong>Add to Home Screen</strong> → <strong>Add</strong>.
                </li>
                <li>Open “Xeltrix” from your home screen — full-screen, like an app.</li>
              </ol>
            </div>
            <div>
              <div className="text-sm font-medium">Android (Chrome)</div>
              <ol className="mt-1 list-decimal pl-5 text-sm text-zinc-600 dark:text-zinc-400">
                <li>Tap <strong>Install</strong> on the banner at the top, or</li>
                <li>
                  Open the <strong>⋮</strong> menu → <strong>Install app</strong> (or “Add to
                  Home screen”).
                </li>
                <li>Open “Xeltrix” from your home screen.</li>
              </ol>
            </div>
          </div>
          <p className="px-4 pb-4 text-xs text-zinc-500">
            It opens full-screen and updates automatically — needs internet to load.
          </p>
        </details>
      </CardContent>
    </Card>
  );
}
