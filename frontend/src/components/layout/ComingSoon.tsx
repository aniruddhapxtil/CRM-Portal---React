import { AppLayout } from "./AppLayout";
import { PageHeader } from "./PageHeader";

export function ComingSoon({ title }: { title: string }) {
  return (
    <AppLayout>
      <PageHeader title={title} subtitle="This page is being built in the next phase." />
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
        Coming soon.
      </div>
    </AppLayout>
  );
}
