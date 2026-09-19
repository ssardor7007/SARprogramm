import { useState, type ComponentType } from 'react'
import { CatalogView } from './components/CatalogView'
import { CompareView } from './components/CompareView'
import { DesignerView } from './components/DesignerView'
import { CatalogIcon, CompareIcon, DesignerIcon } from './components/NavIcons'
import { PRODUCTS } from './data/products'
import { brandColor } from './lib/brandTheme'
import { visibleBrands } from './lib/features'
import { usePersistedList } from './lib/storage'

type Tab = 'compare' | 'catalog' | 'designer'

const TABS: { id: Tab; label: string; icon: ComponentType }[] = [
  { id: 'compare', label: 'Сравнение / КП', icon: CompareIcon },
  { id: 'designer', label: 'Подбор по объекту', icon: DesignerIcon },
  { id: 'catalog', label: 'Каталог', icon: CatalogIcon },
]

function App() {
  const [tab, setTab] = useState<Tab>('compare')

  const catalog = usePersistedList('products', PRODUCTS)

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
                <p className="text-xs text-[var(--text-muted)]">Сетевое оборудование и видеонаблюдение</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {visibleBrands().map((b) => (
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
        {tab === 'compare' && <CompareView catalog={catalog.items} />}
        {tab === 'designer' && <DesignerView catalog={catalog.items} />}
        {tab === 'catalog' && (
          <CatalogView
            items={catalog.items}
            onSave={catalog.upsert}
            onRemove={catalog.remove}
            onReset={catalog.resetToSeed}
          />
        )}
      </main>
    </div>
  )
}

export default App
