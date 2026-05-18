import { Nav } from '@/components/Nav';
import { GoalForm } from '@/components/GoalForm';

export default function NewGoalPage() {
  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold mb-4">New goal</h1>
        <div className="card p-4">
          <GoalForm />
        </div>
      </main>
    </>
  );
}
