import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', label: 'Home', icon: '⌂' },
  { to: '/stats', label: 'Stats', icon: '▲' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 border-t border-neutral-900/10 dark:border-white/10 bg-white/90 dark:bg-neutral-950/90 backdrop-blur pb-[env(safe-area-inset-bottom)] z-40">
      <div className="max-w-md mx-auto flex">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-indigo-500'
                  : 'text-neutral-400 dark:text-neutral-500'
              }`
            }
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
