export const formatCurrency = (amount) => {
  const numberAmount = typeof amount === 'number' ? amount : 0
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberAmount)
}

export const formatNumber = (num) => {
  return new Intl.NumberFormat('pt-BR').format(num)
}

export const getStartOfDay = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
