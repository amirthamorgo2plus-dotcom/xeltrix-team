"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "xt-install-dismissed";

export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return; // already installed

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    let raf = 0;
    if (isIOS) {
      // iOS has no install event — show manual steps (async to avoid a sync
      // setState in the effect body).
      raf = requestAnimationFrame(() => {
        setIos(true);
        setShow(true);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setShow(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm md:px-6">
      <Download className="hidden h-4 w-4 shrink-0 text-emerald-600 sm:block" />
      {ios ? (
        <p className="flex-1 text-zinc-700 dark:text-zinc-300">
          Install Xeltrix: tap{" "}
          <Share className="inline h-3.5 w-3.5 align-[-2px]" /> <strong>Share</strong> then{" "}
          <strong>Add to Home Screen</strong>.
        </p>
      ) : (
        <p className="flex-1 text-zinc-700 dark:text-zinc-300">
          Install Xeltrix as an app for one-tap, full-screen access.
        </p>
      )}
      {!ios && deferred && (
        <button
          type="button"
          onClick={install}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
        >
          Install
        </button>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
