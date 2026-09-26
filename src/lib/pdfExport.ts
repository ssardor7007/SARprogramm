/**
 * Собирает PDF из готовых A4-страниц (DOM-узлы 794×1123 px) и скачивает файл.
 *
 * Не через window.print(): во встроенном виде (iframe на Higgsfield) браузер часто блокирует
 * диалог печати, и кнопка «ничего не делала». Здесь каждая страница снимается в картинку
 * высокого разрешения и кладётся в PDF — результат одинаковый в любом браузере, со шрифтами,
 * фото товаров и картой покрытия. Библиотеки грузятся лениво, только при нажатии.
 */
export const PAGE_W = 794
export const PAGE_H = 1123

export async function exportPagesToPdf(pages: HTMLElement[], filename: string) {
  const [{ jsPDF }, htmlToImage] = await Promise.all([import('jspdf'), import('html-to-image')])
  await document.fonts?.ready

  let fontEmbedCSS: string | undefined
  try {
    fontEmbedCSS = await htmlToImage.getFontEmbedCSS(pages[0])
  } catch {
    fontEmbedCSS = undefined // без встраивания шрифтов PDF всё равно соберётся, системным шрифтом
  }

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()

  for (const [i, node] of pages.entries()) {
    const dataUrl = await htmlToImage.toJpeg(node, {
      quality: 0.93,
      pixelRatio: 2.5,
      width: PAGE_W,
      height: PAGE_H,
      backgroundColor: '#ffffff',
      fontEmbedCSS,
      // Предпросмотр в окне уменьшен через transform — на снимок это не должно влиять.
      style: { transform: 'none', margin: '0' },
    })
    if (i > 0) pdf.addPage()
    pdf.addImage(dataUrl, 'JPEG', 0, 0, w, h, undefined, 'FAST')
  }

  pdf.setProperties({ title: filename.replace(/\.pdf$/i, '') })
  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return { blob, url }
}
