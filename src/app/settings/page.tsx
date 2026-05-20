import { Nav } from '@/components/Nav';
import { PushControls } from '@/components/PushControls';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LogoutButton } from '@/components/LogoutButton';
import { Bell, Palette, Download, Keyboard, LogOut } from 'lucide-react';

export const dynamic = 'force-dynamic';

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <h2 className="flex items-center gap-2 font-semibold">
      <Icon size={18} className="text-accent" />
      {title}
    </h2>
  );
}

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5 animate-fade-in">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </header>

        <section className="card p-5 space-y-4">
          <SectionHeader icon={Bell} title="Notifications" />
          <PushControls />
        </section>

        <section className="card p-5 space-y-4">
          <SectionHeader icon={Palette} title="Appearance" />
          <ThemeToggle />
        </section>

        <section className="card p-5 space-y-4">
          <SectionHeader icon={Download} title="Export data" />
          <p className="text-sm text-muted">Your data, yours to take. Downloads everything.</p>
          <div className="flex gap-2">
            <a className="btn" href="/api/export?format=json">
              Download JSON
            </a>
            <a className="btn" href="/api/export?format=csv">
              Download CSV
            </a>
          </div>
        </section>

        <section className="card p-5 space-y-4">
          <SectionHeader icon={Keyboard} title="Shortcuts & tips" />
          <ul className="text-sm text-muted space-y-2">
            <li className="flex items-center gap-2">
              <kbd className="chip-muted">⌘K</kbd>
              <kbd className="chip-muted">Ctrl+K</kbd>
              <span>Command palette</span>
            </li>
            <li className="flex items-center gap-2">
              <kbd className="chip-muted">n</kbd>
              <span>New goal</span>
            </li>
            <li className="flex items-center gap-2">
              <kbd className="chip-muted">g</kbd>
              <span>Jump to goals</span>
            </li>
            <li className="text-muted-2">Entries lock 24h after creation — keeps history honest.</li>
          </ul>
        </section>

        <section className="card p-5 space-y-4">
          <SectionHeader icon={LogOut} title="Session" />
          <LogoutButton />
        </section>
      </main>
    </>
  );
}
