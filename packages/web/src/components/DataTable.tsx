import type { ReactNode } from 'react';

type DataTableProps<T> = {
  items: T[];
  columns: Array<{
    header: string;
    render: (item: T) => ReactNode;
    className?: string;
  }>;
  getKey: (item: T) => string;
  empty?: ReactNode;
};

export function DataTable<T>({ items, columns, getKey, empty }: DataTableProps<T>) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-coastal-200 bg-white/60 p-8 text-center text-sm text-slate-600">
        {empty ?? 'No records yet.'}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-coastal-100 bg-white/80 shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-coastal-100">
          <thead className="bg-coastal-50/80">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.header}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.16em] text-coastal-700 ${column.className ?? ''}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-coastal-50">
            {items.map((item) => (
              <tr key={getKey(item)} className="hover:bg-sky-50/60">
                {columns.map((column) => (
                  <td key={column.header} className={`px-4 py-4 align-top text-sm text-slate-700 ${column.className ?? ''}`}>
                    {column.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
