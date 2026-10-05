/**
 * Минимальный генератор настоящего .xlsx (Office Open XML) без тяжёлых библиотек: книга —
 * это zip с несколькими XML-файлами. Excel, LibreOffice и Google Таблицы открывают его без
 * предупреждений, в отличие от CSV (кодировка, «;» против «,», числа как текст).
 * fflate грузится лениво — только когда пользователь нажал «Скачать Excel».
 */

export type CellKind = 'text' | 'int' | 'money' | 'usd'
export type Cell = string | number | null | undefined

export interface SheetColumn {
  header: string
  /** Ширина в символах */
  width?: number
  kind?: CellKind
}

export interface Sheet {
  name: string
  /** Заголовок над таблицей (первая строка) */
  title?: string
  /** Строки под заголовком, до шапки таблицы: «Клиент: …», «Дата: …» */
  meta?: string[]
  columns: SheetColumn[]
  rows: Cell[][]
  /** Итоговые строки под таблицей — жирные */
  totals?: Cell[][]
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // управляющие символы запрещены в XML
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')

function colName(i: number) {
  let n = i + 1
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// Индексы стилей из styles.xml ниже
const STYLE = { text: 0, header: 1, int: 2, money: 3, usd: 4, title: 5, meta: 6, totalText: 7, totalMoney: 8, totalUsd: 9, totalInt: 10 }

function cellXml(ref: string, value: Cell, kind: CellKind, total = false) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    const style = total
      ? kind === 'usd'
        ? STYLE.totalUsd
        : kind === 'int'
          ? STYLE.totalInt
          : STYLE.totalMoney
      : kind === 'usd'
        ? STYLE.usd
        : kind === 'money'
          ? STYLE.money
          : STYLE.int
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`
  }
  const style = total ? STYLE.totalText : STYLE.text
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`
}

function sheetXml(sheet: Sheet) {
  const rows: string[] = []
  let r = 1
  const lastCol = colName(Math.max(0, sheet.columns.length - 1))
  const merges: string[] = []
  if (sheet.title) {
    rows.push(`<row r="${r}" ht="24" customHeight="1"><c r="A${r}" s="${STYLE.title}" t="inlineStr"><is><t>${esc(sheet.title)}</t></is></c></row>`)
    merges.push(`A${r}:${lastCol}${r}`)
    r++
  }
  for (const line of sheet.meta ?? []) {
    rows.push(`<row r="${r}"><c r="A${r}" s="${STYLE.meta}" t="inlineStr"><is><t xml:space="preserve">${esc(line)}</t></is></c></row>`)
    merges.push(`A${r}:${lastCol}${r}`)
    r++
  }
  if (sheet.title || sheet.meta?.length) r++
  const headerRow = r
  rows.push(
    `<row r="${r}" ht="20" customHeight="1">${sheet.columns
      .map((c, i) => `<c r="${colName(i)}${r}" s="${STYLE.header}" t="inlineStr"><is><t>${esc(c.header)}</t></is></c>`)
      .join('')}</row>`,
  )
  r++
  for (const row of sheet.rows) {
    rows.push(`<row r="${r}">${row.map((v, i) => cellXml(`${colName(i)}${r}`, v, sheet.columns[i]?.kind ?? 'text')).join('')}</row>`)
    r++
  }
  for (const row of sheet.totals ?? []) {
    rows.push(`<row r="${r}">${row.map((v, i) => cellXml(`${colName(i)}${r}`, v, sheet.columns[i]?.kind ?? 'text', true)).join('')}</row>`)
    r++
  }
  const cols = sheet.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join('')
  const lastDataRow = headerRow + sheet.rows.length
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    (sheet.rows.length ? `<autoFilter ref="A${headerRow}:${lastCol}${lastDataRow}"/>` : '') +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '') +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    `</worksheet>`
  )
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="&quot;$&quot;#,##0.00"/></numFmts>` +
  `<fonts count="4">` +
  `<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="15"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>` +
  `</fonts>` +
  `<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF2F5FE0"/><bgColor indexed="64"/></patternFill></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F8"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>` +
  `<border><left/><right/><top style="thin"><color rgb="FF9AA3B5"/></top><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="11">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>` +
  `<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="3" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="165" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `<xf numFmtId="164" fontId="3" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`

function safeSheetName(name: string, used: Set<string>) {
  let base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Лист'
  let n = 2
  while (used.has(base.toLowerCase())) base = `${base.slice(0, 28)} ${n++}`
  used.add(base.toLowerCase())
  return base
}

export async function buildXlsx(sheets: Sheet[]): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate')
  const used = new Set<string>()
  const names = sheets.map((s) => safeSheetName(s.name, used))
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        sheets
          .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join('') +
        `</Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
        `</Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets>${names.map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>` +
        `</workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        sheets
          .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
          .join('') +
        `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES_XML),
  }
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s))
  })
  const zipped = zipSync(files, { level: 6 })
  return new Blob([zipped as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function downloadXlsx(filename: string, sheets: Sheet[]) {
  downloadBlob(await buildXlsx(sheets), filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export function safeFileName(s: string) {
  return s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()
}
