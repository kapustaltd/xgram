/** First file in a paste/drop (screenshots arrive as unnamed "image.png" blobs). */
export function fileFromTransfer(data: DataTransfer | null): File | null {
  if (!data) return null
  for (const item of data.items) {
    if (item.kind !== 'file') continue
    const f = item.getAsFile()
    if (!f) continue
    if (f.name && f.name !== 'image.png') return f
    const ext = f.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    return new File([f], `image-${Date.now()}.${ext}`, { type: f.type || 'image/png' })
  }
  return null
}

/** Insert text at the textarea caret and return the new value + caret position. */
export function insertAtCaret(el: HTMLTextAreaElement | null, value: string, insert: string): [string, number] {
  const start = el?.selectionStart ?? value.length
  const end = el?.selectionEnd ?? value.length
  return [value.slice(0, start) + insert + value.slice(end), start + insert.length]
}
