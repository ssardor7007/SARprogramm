import { useState, type ComponentType } from 'react'
import { CompareView } from './components/CompareView'
import { CompetitorCatalogView } from './components/CompetitorCatalogView'
import { DesignerView } from './components/DesignerView'
import { CatalogIcon, CompareIcon, CompetitorsIcon, DesignerIcon } from './components/NavIcons'
import { OwnCatalogView } from './components/OwnCatalogView'
import { COMPETITOR_PRODUCTS } from './data/competitorProducts'
import { OWN_PRODUCTS } from './data/ownProducts'
import { brandColor } from './lib/brandTheme'
import { filterCompetitorProducts, filterOwnProducts, visibleOwnBrands } from './lib/features'
import { usePersistedList } from './lib/storage'

type Tab = 'compare' | 'catalog' | 'competitors' | 'designer'

const TABS: { id: Tab; label: string; icon: ComponentType }[] = [
  { id: 'compare', label: 'Сравнение / КП', icon: CompareIcon },
  { id: 'designer', label: 'Подбор по объекту', icon: DesignerIcon },
  { id: 'catalog', label: 'Мой каталог', icon: CatalogIcon },
  { id: 'competitors', label: 'Конкуренты', icon: CompetitorsIcon },
]

function App() {
  const [tab, setTab] = useState<Tab>('compare')

  const own = usePersistedList('own-products', filterOwnProducts(OWN_PRODUCTS))
  const competitors = usePersistedList('competitor-products', filterCompetitorProducts(COMPETITOR_PRODUCTS))

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 pt-5 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="font-display flex h-10 w-10 items-center justify-center rounded-xl text-base font-extrabold text-[var(--accent-ink)]"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                S
              </div>
              <div>
                <h1 className="font-display text-lg font-extrabold text-[var(--text)]">SAR</h1>
                <p className="text-xs text-[var(--text-muted)]">Сетевое оборудование</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {visibleOwnBrands().map((b) => (
                <span
                  key={b}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: brandColor(b) }} />
                  {b}
                </span>
              ))}
            </div>
          </div>

          <nav className="mt-4 flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors"
                  style={
                    active
                      ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                      : { borderColor: 'transparent', color: 'var(--text-muted)' }
                  }
                >
                  <span className="h-4 w-4">
                    <Icon />
                  </span>
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0">
        {tab === 'compare' && <CompareView competitorCatalog={competitors.items} ownCatalog={own.items} />}
        {tab === 'designer' && <DesignerView ownCatalog={own.items} />}
        {tab === 'catalog' && (
          <OwnCatalogView
            items={own.items}
            onSave={own.upsert}
            onRemove={own.remove}
            onReset={own.resetToSeed}
          />
        )}
        {tab === 'competitors' && (
          <CompetitorCatalogView
            items={competitors.items}
            ownCatalog={own.items}
            onSave={competitors.upsert}
            onRemove={competitors.remove}
            onReset={competitors.resetToSeed}
          />
        )}
      </main>
    </div>
  )
}

export default App
