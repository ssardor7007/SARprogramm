interface Props {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}

export function StringListEditor({ label, items, onChange, placeholder }: Props) {
  function update(i: number, value: string) {
    const next = [...items]
    next[i] = value
    onChange(next)
  }

  function remove(i: number) {
    onChange(items.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-700">{label}</label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
            value={item}
            placeholder={placeholder}
            onChange={(e) => update(i, e.target.value)}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Удалить"
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, ''])}
        className="text-sm font-medium text-blue-600 hover:text-blue-800"
      >
        + добавить
      </button>
    </div>
  )
}
