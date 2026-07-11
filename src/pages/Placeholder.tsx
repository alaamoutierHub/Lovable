import { Card } from "../components/ui/primitives";

export default function Placeholder({ title, stage }: { title: string; stage: string }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-50">{title}</h1>
      <Card className="max-w-lg">
        <p className="text-sm text-slate-500">
          This module is planned for <span className="font-medium">{stage}</span> of the build sequence
          (see <code>docs/01-architecture-and-build-plan.md</code>). The calculation engine and data
          model it depends on are already in place.
        </p>
      </Card>
    </div>
  );
}
