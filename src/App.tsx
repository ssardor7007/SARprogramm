import { useState } from 'react'
import { CompareView } from './components/CompareView'
import { CompetitorCatalogView } from './components/CompetitorCatalogView'
import { DesignerView } from './components/DesignerView'
import { OwnCatalogView } from './components/OwnCatalogView'
import { COMPETITOR_PRODUCTS } from './data/competitorProducts'
import { OWN_PRODUCTS } from './data/ownProducts'
import { usePersistedList } from './lib/storage'

type Tab = 'compare' | 'catalog' | 'competitors' | 'designer'

const TABS: { id: Tab; label: string }[] = [
  { id: 'compare', label: 'Сравнение / КП' },
  { id: 'designer', label: 'Подбор по объекту' },
  { id: 'catalog', label: 'Мой каталог' },
  { id: 'competitors', label: 'Конкуренты' },
]

function App() {
  const [tab, setTab] = useState<Tab>('compare')

  const own = usePersistedList('own-products', OWN_PRODUCTS)
  const competitors = usePersistedList('competitor-products', COMPETITOR_PRODUCTS)

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-900">SAR — сравнение оборудования</h1>
              <p className="text-xs text-slate-500">TP-Link · Vitek · Hikvision — предложения против конкурентов</p>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-t-md px-3 py-1.5 text-sm font-medium ${
                  tab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
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
