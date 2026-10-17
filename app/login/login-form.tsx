"use client";

import { useState } from "react";
import { Button, Banner } from "@/components/ui";
import { IconLock, IconBackspace } from "@/components/icons";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * Staff sign-in.
 *
 * The dots and the keypad are a JS convenience only. The form itself is a plain
 * HTML POST to `/api/login`, so a phone that never runs our client bundle can
 * still sign in by typing the six digits into the PIN box.
 */
export function LoginForm({ error }: { error?: string | null }) {
  const [pin, setPin] = useState("");

  function press(d: string) {
    setPin((p) => (p.length >= 6 ? p : p + d));
  }
  function back() {
    setPin((p) => p.slice(0, -1));
  }

  return (
    <form action="/api/login" method="post" className="space-y-4">
      {error ? <Banner tone="red">{error}</Banner> : null}

      <div className="flex justify-center gap-2.5" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={
              "h-12 w-11 rounded-xl border flex items-center justify-center text-xl font-semibold " +
              (pin.length > i
                ? "bg-brand-soft border-brand text-brand-strong"
                : "bg-surface border-border text-muted")
            }
          >
            {pin.length > i ? "•" : ""}
          </span>
        ))}
      </div>

      {/* Native input: phone keyboard entry, and also works with zero
          client-side JS (plain form POST to /api/login). */}
      <input
        type="password"
        name="pin"
        value={pin}
        onChange={(e) =>
          setPin(e.target.value.replace(/\D/g, "").slice(0, 6))
        }
        inputMode="numeric"
        autoComplete="one-time-code"
        enterKeyHint="go"
        maxLength={6}
        minLength={6}
        pattern="[0-9]{6}"
        required
        title="6-digit PIN"
        placeholder="Type PIN here"
        aria-label="6-digit PIN"
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-center text-xl font-semibold tracking-[0.5em] text-ink placeholder:text-sm placeholder:font-normal placeholder:tracking-normal placeholder:text-muted"
      />

      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map((k) => (
          <KeyBtn key={k} onClick={() => press(k)}>
            {k}
          </KeyBtn>
        ))}
        <KeyBtn onClick={() => setPin("")} subtle>
          Clear
        </KeyBtn>
        <KeyBtn onClick={() => press("0")}>0</KeyBtn>
        <KeyBtn onClick={back} subtle aria-label="Backspace">
          <IconBackspace size={22} className="mx-auto" />
        </KeyBtn>
      </div>

      <Button type="submit" block size="lg">
        <IconLock size={18} />
        Sign in
      </Button>
    </form>
  );
}

function KeyBtn({
  children,
  onClick,
  subtle,
  ...rest
}: React.ComponentProps<"button"> & { subtle?: boolean }) {
  return (
    <button
      {...rest}
      type="button"
      onClick={onClick}
      className={
        "min-h-14 rounded-xl text-lg font-semibold border transition active:scale-[0.98] " +
        (subtle
          ? "bg-surface-2 border-border text-muted text-sm"
          : "bg-surface border-border text-ink hover:bg-surface-2")
      }
    >
      {children}
    </button>
  );
}
