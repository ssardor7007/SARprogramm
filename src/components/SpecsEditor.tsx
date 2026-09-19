interface Props {
  specs: Record<string, string>
  onChange: (specs: Record<string, string>) => void
}

export function SpecsEditor({ specs, onChange }: Props) {
  const entries = Object.entries(specs)

  function updateEntry(index: number, key: string, value: string) {
    const next = [...entries]
    next[index] = [key, value]
    onChange(Object.fromEntries(next))
  }

  function removeEntry(index: number) {
    const next = entries.filter((_, i) => i !== index)
    onChange(Object.fromEntries(next))
  }

  function addEntry() {
    onChange({ ...specs, ['Новая характеристика']: '' })
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">Характеристики</label>
      {entries.map(([key, value], i) => (
        <div key={i} className="flex gap-2">
          <input
            className="w-1/2 rounded border border-slate-300 px-2 py-1 text-sm"
            value={key}
            placeholder="Название"
            onChange={(e) => updateEntry(i, e.target.value, value)}
          />
          <input
            className="w-1/2 rounded border border-slate-300 px-2 py-1 text-sm"
            value={value}
            placeholder="Значение"
            onChange={(e) => updateEntry(i, key, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeEntry(i)}
            className="rounded px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Удалить характеристику"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addEntry}
        className="text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        + добавить характеристику
      </button>
    </div>
  )
}
