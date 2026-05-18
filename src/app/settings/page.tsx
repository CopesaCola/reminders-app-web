import { Nav } from '@/components/Nav';
import { PushControls } from '@/components/PushControls';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-xl font-semibold">Settings</h1>

        <section className="card p-4 space-y-3">
          <h2 className="font-medium">Notifications</h2>
          <PushControls />
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="font-medium">Appearance</h2>
          <ThemeToggle />
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="font-medium">Export data</h2>
          <div className="flex gap-2">
            <a className="btn" href="/api/export?format=json">
              Download JSON
            </a>
            <a className="btn" href="/api/export?format=csv">
              Download CSV
            </a>
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="font-medium">Tips</h2>
          <ul className="list-disc list-inside text-sm text-muted space-y-1">
            <li>Press <kbd className="px-1.5 py-0.5 rounded border border-border">⌘K</kbd> / <kbd className="px-1.5 py-0.5 rounded border border-border">Ctrl+K</kbd> for the command palette.</li>
            <li>Press <kbd className="px-1.5 py-0.5 rounded border border-border">n</kbd> on the dashboard to add a new goal.</li>
            <li>Entries lock 24h after creation — keeps history honest.</li>
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="font-medium mb-3">Session</h2>
          <LogoutButton />
        </section>
      </main>
    </>
  );
}
