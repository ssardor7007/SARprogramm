import { useState, type ComponentType } from 'react'
import { BuildingPlanView } from './components/BuildingPlanView'
import { CatalogView } from './components/CatalogView'
import { DesignerView } from './components/DesignerView'
import { CatalogIcon, DesignerIcon, PlanIcon, QuoteIcon, RackIcon, ToolsIcon } from './components/NavIcons'
import { QuoteView } from './components/QuoteView'
import { RackDesignerView } from './components/RackDesignerView'
import { CATALOG_VERSION, PRODUCTS } from './data/products'
import { brandColor } from './lib/brandTheme'
import { visibleBrands } from './lib/features'
import { usePersistedList } from './lib/storage'

type Section = 'client' | 'pro'
type ClientTab = 'catalog' | 'quote'
type ProTab = 'designer' | 'plan' | 'rack'

const CLIENT_TABS: { id: ClientTab; label: string; icon: ComponentType }[] = [
  { id: 'catalog', label: 'Каталог', icon: CatalogIcon },
  { id: 'quote', label: 'Коммерческое предложение', icon: QuoteIcon },
]

const PRO_TABS: { id: ProTab; label: string; icon: ComponentType }[] = [
  { id: 'designer', label: 'Подбор по объекту', icon: DesignerIcon },
  { id: 'plan', label: 'План здания', icon: PlanIcon },
  { id: 'rack', label: 'Стойка', icon: RackIcon },
]

function App() {
  const [section, setSection] = useState<Section>('client')
  const [clientTab, setClientTab] = useState<ClientTab>('catalog')
  const [proTab, setProTab] = useState<ProTab>('designer')

  const catalog = usePersistedList('products', PRODUCTS, CATALOG_VERSION)

  const tabs = section === 'client' ? CLIENT_TABS : PRO_TABS
  const activeTab = section === 'client' ? clientTab : proTab
  const setActiveTab = (id: string) => (section === 'client' ? setClientTab(id as ClientTab) : setProTab(id as ProTab))

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

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <nav className="flex gap-1 overflow-x-auto">
              {tabs.map((t) => {
                const Icon = t.icon
                const active = activeTab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
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

            <button
              onClick={() => setSection(section === 'client' ? 'pro' : 'client')}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-black/5"
            >
              {section === 'client' ? (
                <>
                  <span className="h-3.5 w-3.5">
                    <ToolsIcon />
                  </span>
                  Инструменты для монтажников
                </>
              ) : (
                '← В каталог'
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0">
        {section === 'client' && clientTab === 'catalog' && (
          <CatalogView
            items={catalog.items}
            onSave={catalog.upsert}
            onRemove={catalog.remove}
            onReset={catalog.resetToSeed}
          />
        )}
        {section === 'client' && clientTab === 'quote' && <QuoteView catalog={catalog.items} />}
        {section === 'pro' && proTab === 'designer' && (
          <DesignerView catalog={catalog.items} onSentToRack={() => setProTab('rack')} />
        )}
        {section === 'pro' && proTab === 'plan' && <BuildingPlanView catalog={catalog.items} />}
        {section === 'pro' && proTab === 'rack' && <RackDesignerView catalog={catalog.items} />}
      </main>
    </div>
  )
}

export default App
