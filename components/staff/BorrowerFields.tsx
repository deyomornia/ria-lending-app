const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2.5 text-base shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600";
const labelCls = "mb-1 block text-sm font-medium uppercase tracking-wide text-slate-700";

export function BorrowerFields({
  defaults,
}: {
  defaults?: Partial<{
    full_name: string;
    phone: string;
    address: string;
    id_type: string;
    id_number: string;
    notes: string;
  }>;
}) {
  return (
    <>
      <div>
        <label className={labelCls}>Full name *</label>
        <input name="full_name" required className={inputCls} defaultValue={defaults?.full_name} />
      </div>
      <div>
        <label className={labelCls}>Mobile number *</label>
        <input
          name="phone"
          required
          placeholder="0917 123 4567"
          className={inputCls}
          defaultValue={defaults?.phone}
        />
      </div>
      <div>
        <label className={labelCls}>Address</label>
        <input name="address" className={inputCls} defaultValue={defaults?.address} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>ID type</label>
          <input
            name="id_type"
            placeholder="e.g. UMID, Driver's License"
            className={inputCls}
            defaultValue={defaults?.id_type}
          />
        </div>
        <div>
          <label className={labelCls}>ID number</label>
          <input name="id_number" className={inputCls} defaultValue={defaults?.id_number} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Notes</label>
        <textarea name="notes" rows={2} className={inputCls} defaultValue={defaults?.notes} />
      </div>
    </>
  );
}
