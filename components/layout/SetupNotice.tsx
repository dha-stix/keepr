/** Shown instead of the app while the Firebase web config is missing from .env.local. */
export function SetupNotice({ missing }: { missing: string[] }) {
  return (
    <main className="container-x grid min-h-dvh place-items-center py-16">
      <div className="card w-full max-w-[560px] p-6 md:p-8">
        <div className="num text-[11px] tracking-[.1em] text-brass uppercase">Setup needed</div>
        <h1 className="display mt-2 text-[30px]">Connect Keepr to Firebase</h1>
        <p className="mt-3 text-muted">
          Add these values to <code>.env.local</code> (Firebase console → Project settings → Your apps → Web app), then restart{" "}
          <code>npm run dev</code>.
        </p>
        <ul className="mt-4 grid gap-1 text-sm">
          {missing.map(k => (
            <li key={k}>
              <code>{k}</code>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">The full list, including the Admin SDK and Bachs keys, is in .env.example.</p>
      </div>
    </main>
  );
}
