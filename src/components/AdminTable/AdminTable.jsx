import styles from '../../pages/Admin/AdminPanel.module.css';

/**
 * AdminTable — shared table component for all admin panel tabs.
 *
 * Props:
 *   columns  — array of { key, header, align?, width?, render(row, index) }
 *   data     — array of row objects
 *   rowKey   — function(row) → unique key, defaults to row.id
 *   empty    — string shown when data is empty, default "No data."
 *   srOffset — number to add to the displayed Sr. No. (for paginated tables)
 */
export default function AdminTable({ columns, data, rowKey, empty = 'No data.', srOffset = 0 }) {
  if (!data || data.length === 0) {
    return (
      <div className={styles['empty-state']}>
        <p>{empty}</p>
      </div>
    );
  }

  const getKey = rowKey ?? (row => row.id);

  return (
    <table className={styles['data-table']}>
      <thead>
        <tr>
          <th style={{ width: 48 }}>Sr.</th>
          {columns.map(col => (
            <th
              key={col.key}
              style={{
                textAlign: col.align ?? 'left',
                width: col.width ?? undefined,
              }}
            >
              {col.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={getKey(row)}>
            <td style={{ color: 'var(--color-charcoal-light)', width: 48 }}>
              {srOffset + i + 1}
            </td>
            {columns.map(col => (
              <td
                key={col.key}
                style={{
                  textAlign: col.align ?? 'left',
                  width: col.width ?? undefined,
                }}
              >
                {col.render ? col.render(row, i) : row[col.key] ?? '—'}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
