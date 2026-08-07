export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-ink-900 sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-1.5 text-base text-ink-600">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
