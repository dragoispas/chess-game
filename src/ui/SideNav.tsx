import './SideNav.css'

export type AppNav = 'play' | 'sandbox' | 'credits'

type SideNavProps = {
  active: AppNav
  onNavigate: (nav: AppNav) => void
}

const NAV_ITEMS: { id: AppNav; label: string }[] = [
  { id: 'play', label: 'Play' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'credits', label: 'Credits' },
]

export function SideNav({ active, onNavigate }: SideNavProps) {
  return (
    <nav className="side-nav" aria-label="Main">
      <p className="side-nav-brand">Chess</p>
      <ul className="side-nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={[
                'side-nav-item',
                active === item.id ? 'active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={active === item.id ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
