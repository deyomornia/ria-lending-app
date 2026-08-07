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
    <div className="border-base-300 mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-base-content/70 mt-1 text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}
