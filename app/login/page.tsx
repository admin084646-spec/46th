import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

/**
 * Always show the PIN pad. A previously signed-in session is deliberately NOT
 * auto-resumed here, so nobody can walk up to the counter device and land in
 * the cashier workspace without entering a PIN.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? "Invalid PIN. Please try again." : null;

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10 flex-1 flex flex-col justify-center">
      <div className="relative mx-auto mb-4 h-14 w-14">
        <span className="brand-band grid h-14 w-14 place-items-center rounded-2xl text-white text-2xl font-bold ring-1 ring-brand/20 shadow-pop">
          M
        </span>
        <span
          aria-hidden
          className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-green ring-2 ring-white"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
        </span>
      </div>
      <div className="text-center mb-6">
        <h1 className="text-lg font-bold text-ink">Staff sign in</h1>
        <p className="text-sm text-muted mt-1">
          Enter your 6-digit PIN
        </p>
      </div>
      <LoginForm error={error} />
      <p className="text-center text-xs text-muted mt-6 leading-relaxed">
        Forgot your PIN? Ask the owner to reset it.
      </p>
    </main>
  );
}
