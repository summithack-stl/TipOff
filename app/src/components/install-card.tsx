"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/lib/install-prompt";

// UI: Sarthak — smallest functional version. All the logic lives in @/lib/install-prompt.
const STEPS_IOS = [
  "Open this page in Safari.",
  "Tap the Share button (the square with an arrow).",
  "Choose \"Add to Home Screen\", then Add.",
];

export function InstallCard() {
  const { canPrompt, installed, ios, install } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(false);

  if (installed) {
    return (
      <p className="text-sm text-muted-foreground">
        TipOff is installed on this device. It opens to today&apos;s crew list.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border p-6">
        <h3 className="font-medium">iPhone or iPad</h3>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {STEPS_IOS.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="font-mono text-xs text-[var(--hot)] tabular-nums">0{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-lg border p-6">
        <h3 className="font-medium">Android</h3>
        {canPrompt ? (
          <>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Chrome can add TipOff to your home screen now.
            </p>
            <Button
              className="mt-4"
              onClick={() => {
                // The event is single-use: if the user says no, fall back to the manual steps.
                void install().then((accepted) => setDismissed(!accepted));
              }}
            >
              Install TipOff
            </Button>
          </>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {dismissed
              ? "No problem. You can still install it from Chrome's menu: tap ⋮, then “Add to Home screen”."
              : ios
                ? "Open this page in Chrome on an Android phone and it will offer to install."
                : "Open this page in Chrome on an Android phone, or use the menu: ⋮, then “Add to Home screen”."}
          </p>
        )}
      </div>
    </div>
  );
}
