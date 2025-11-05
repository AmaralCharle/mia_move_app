export function toJSDate(value) {
  if (!value && value !== 0) return null
  // Firestore Timestamp has toDate()
  if (value && typeof value.toDate === 'function') {
    try { return value.toDate() } catch (e) { return null }
  }
  // Already a Date
  if (value instanceof Date) return value
  // number (epoch ms) or ISO string
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}

export function toISO(value) {
  const d = toJSDate(value)
  return d ? d.toISOString() : null
}
