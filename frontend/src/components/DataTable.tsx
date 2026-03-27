import type { TableData } from '../types';

interface Props {
  table: TableData;
}

export function DataTable({ table }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 my-3 overflow-hidden">
      {table.title && (
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h4 className="font-semibold text-gray-700 text-sm">{table.title}</h4>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              {table.headers.map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-4 py-2 text-gray-700 border-b border-gray-100">
                    {cell}
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
