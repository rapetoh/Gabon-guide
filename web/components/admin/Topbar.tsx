// Shared topbar for every admin page.
// Layout: breadcrumb above title on the left, optional actions slot on the right.

import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface Props {
  title: string
  breadcrumb?: BreadcrumbItem[]
  actions?: React.ReactNode
  /** Optional right-aligned hint text (e.g. counts, status). Shown below actions when present. */
  rightHint?: string
}

export default function Topbar({ title, breadcrumb, actions, rightHint }: Props) {
  return (
    <header className="px-8 py-5 bg-white border-b border-gray-100 flex items-center gap-6">
      <div className="flex-1 min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="text-[11px] text-gray-400 mb-1 flex items-center gap-1.5">
            {breadcrumb.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-gray-300">·</span>}
                {item.href ? (
                  <Link href={item.href} className="hover:text-gray-700">{item.label}</Link>
                ) : (
                  <span>{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight truncate">{title}</h1>
      </div>
      {actions && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {actions}
        </div>
      )}
      {rightHint && (
        <div className="text-xs text-gray-500 font-medium">{rightHint}</div>
      )}
    </header>
  )
}
