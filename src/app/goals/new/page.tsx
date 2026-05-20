import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Nav } from '@/components/Nav';
import { GoalForm } from '@/components/GoalForm';

export default function NewGoalPage() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5 animate-fade-in">
        <Link
          href="/goals"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg transition-colors"
        >
          <ArrowLeft size={16} />
          All goals
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">New goal</h1>
        <div className="card p-5">
          <GoalForm />
        </div>
      </main>
    </>
  );
}
