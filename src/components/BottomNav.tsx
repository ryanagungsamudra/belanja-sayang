import { ChefHat, NotebookPen, ShoppingBasket } from 'lucide-react'

export type AppTab = 'keranjang' | 'referensi' | 'paket'

interface BottomNavProps {
  activeTab: AppTab
  activeItemCount: number
  refCount: number
  templateCount: number
  onChangeTab: (tab: AppTab) => void
}

export function BottomNav({
  activeTab,
  activeItemCount,
  refCount,
  templateCount,
  onChangeTab,
}: BottomNavProps) {
  const tabs: Array<{
    id: AppTab
    label: string
    badge?: number
    icon: typeof ShoppingBasket
  }> = [
    {
      id: 'keranjang',
      label: 'Keranjang',
      badge: activeItemCount > 0 ? activeItemCount : undefined,
      icon: ShoppingBasket,
    },
    {
      id: 'referensi',
      label: 'Catatan',
      badge: refCount,
      icon: NotebookPen,
    },
    {
      id: 'paket',
      label: 'Paket',
      badge: templateCount,
      icon: ChefHat,
    },
  ]

  return (
    <nav
      aria-label="Navigasi Utama"
      className="w-full min-w-0 bg-white border-t border-stone-200/90 px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <div className="grid grid-cols-3 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              data-testid={`nav-tab-${tab.id}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onChangeTab(tab.id)}
              className={`min-h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-[0.97] cursor-pointer relative ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-stone-500 hover:bg-stone-50 hover:text-slate-800'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2.4 : 2} />
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 rounded-full text-[10px] font-bold tabular-nums ${
                      isActive
                        ? 'bg-emerald-600 text-white'
                        : 'bg-stone-200/80 text-stone-600'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold leading-none">
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
