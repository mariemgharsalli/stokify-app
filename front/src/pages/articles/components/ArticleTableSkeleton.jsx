import { checkboxClass, tableCellClass } from "./articlesTheme";

export default function ArticleTableSkeleton({ rows = 8 }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[1240px] w-full border-collapse">
        <thead>
          <tr>
            {Array.from({ length: 13 }).map((_, i) => (
              <th
                key={i}
                className="px-3 py-2.5 border-b border-r border-slate-200/80 dark:border-white/10"
              >
                <div className="h-3 w-12 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, idx) => (
            <tr
              key={idx}
              className="article-fade-up border-t border-slate-100 dark:border-white/[0.06]"
              style={{ animationDelay: `${idx * 35}ms` }}
            >
              <td className={tableCellClass}>
                <div className="h-4 w-4 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
              </td>
              <td className={tableCellClass}>
                <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200 dark:bg-white/10" />
              </td>
              {Array.from({ length: 11 }).map((__, ci) => (
                <td key={ci} className={tableCellClass}>
                  <div
                    className="h-4 animate-pulse rounded bg-slate-200 dark:bg-white/10"
                    style={{ width: `${50 + ((ci * 17) % 40)}%` }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { checkboxClass };
