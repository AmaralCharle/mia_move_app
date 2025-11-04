import React, { useMemo } from 'react'

const StockLevelChart = ({ variants }) => {
  const lowStockThreshold = 5
  const fullStockThreshold = 10

  const stockLevels = useMemo(() => {
    if (!variants || variants.length === 0) {
      return { full: { count: 0, percentage: 0 }, medium: { count: 0, percentage: 0 }, low: { count: 0, percentage: 0 }, outOfStock: { count: 0, percentage: 0 }, total: 0 }
    }

    let full = 0; let medium = 0; let low = 0; let outOfStock = 0
    variants.forEach(v => {
      if (v.quantity === 0) outOfStock++
      else if (v.quantity < lowStockThreshold) low++
      else if (v.quantity < fullStockThreshold) medium++
      else full++
    })
    const total = variants.length
    return { full: { count: full, percentage: (full / total) * 100 }, medium: { count: medium, percentage: (medium / total) * 100 }, low: { count: low, percentage: (low / total) * 100 }, outOfStock: { count: outOfStock, percentage: (outOfStock / total) * 100 }, total }
  }, [variants])

  const Ring = ({ percentage, color, radius, strokeWidth, label, count }) => {
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference
    return (
      <div className="relative flex flex-col items-center justify-center">
        <svg className="transform -rotate-90" width={radius*2 + strokeWidth*2} height={radius*2 + strokeWidth*2}>
          <circle className="text-gray-200 dark:text-gray-700" stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" r={radius} cx={radius + strokeWidth} cy={radius + strokeWidth} />
          <circle className={color} stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" fill="transparent" r={radius} cx={radius + strokeWidth} cy={radius + strokeWidth} style={{ strokeDasharray: circumference, strokeDashoffset: offset, transition: 'stroke-dashoffset 0.5s ease-out' }} />
        </svg>
        <div className="absolute flex flex-col items-center"><span className="text-xl font-bold">{count}</span><span className="text-xs text-gray-500 dark:text-gray-400">{label}</span></div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700">
      <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Visão Geral do Estoque</h3>
      {stockLevels.total === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhum item em estoque para exibir.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center text-center">
          <Ring percentage={stockLevels.full.percentage} color="text-green-500" radius={40} strokeWidth={8} label="Estoque Cheio" count={stockLevels.full.count} />
          <Ring percentage={stockLevels.medium.percentage} color="text-blue-500" radius={40} strokeWidth={8} label="Estoque Médio" count={stockLevels.medium.count} />
          <Ring percentage={stockLevels.low.percentage} color="text-orange-500" radius={40} strokeWidth={8} label="Estoque Baixo" count={stockLevels.low.count} />
          <Ring percentage={stockLevels.outOfStock.percentage} color="text-red-500" radius={40} strokeWidth={8} label="Esgotado" count={stockLevels.outOfStock.count} />
        </div>
      )}
    </div>
  )
}

export default StockLevelChart
