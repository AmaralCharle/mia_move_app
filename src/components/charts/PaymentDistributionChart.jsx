import React, { useMemo } from 'react'

const PaymentDistributionChart = ({ sales }) => {
  const paymentCounts = useMemo(() => {
    const counts = (sales || []).filter(s => s.status !== 'estornada').reduce((acc, sale) => { acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.totalAmount; return acc; }, {})
    const total = Object.values(counts).reduce((sum, val) => sum + val, 0)
    return { data: Object.entries(counts).map(([method, amount]) => ({ method, amount, percentage: total > 0 ? (amount / total) * 100 : 0 })), total }
  }, [sales])

  if (paymentCounts.total === 0) return <p className="text-center text-gray-500 dark:text-gray-400">Sem dados de pagamento.</p>

  const colors = {'Cartão de Crédito':'bg-indigo-500','PIX':'bg-green-500','Dinheiro':'bg-yellow-500','Débito':'bg-pink-500','Outro':'bg-gray-400'}

  return (
    <div className="space-y-4">
      <div className="flex h-6 rounded-full overflow-hidden shadow-inner">{paymentCounts.data.map(i => <div key={i.method} style={{ width: `${i.percentage}%` }} className={colors[i.method] || 'bg-gray-400'} title={`${i.method}: ${i.percentage.toFixed(1)}%`}></div>)}</div>
      <ul className="grid grid-cols-2 gap-2 text-sm">{paymentCounts.data.map(i => <li key={i.method} className="flex items-center space-x-2 text-gray-700 dark:text-gray-300"><span className={`w-3 h-3 rounded-full ${colors[i.method] || 'bg-gray-400'}`}></span><span>{i.method}:</span><span className="font-semibold">{i.percentage.toFixed(1)}%</span></li>)}</ul>
    </div>
  )
}

export default PaymentDistributionChart
