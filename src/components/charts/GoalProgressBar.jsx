import React, { useMemo } from 'react'
import { formatCurrency } from '../../utils/format'

const GoalProgressBar = ({ sales, expenses, monthlyGoal, showTitle = false }) => {
  const { currentValue, progressPercentage, goalType, goalAmount } = useMemo(() => {
    if (!monthlyGoal) return { currentValue: 0, progressPercentage: 0 }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const monthSales = (sales || []).filter(s => s.date.toDate() >= startOfMonth && s.status !== 'estornada')
    const monthExpenses = (expenses || []).filter(e => e.date.toDate() >= startOfMonth && e.status === 'pago')

    let current = 0
    if (monthlyGoal.type === 'revenue') {
      current = monthSales.reduce((sum, s) => sum + s.totalAmount, 0)
    } else {
      const grossProfit = monthSales.reduce((sum, s) => sum + (s.profit || 0), 0)
      const totalExpenses = monthExpenses.reduce((sum, e) => sum + e.amount, 0)
      current = grossProfit - totalExpenses
    }

    const percentage = monthlyGoal.amount > 0 ? (current / monthlyGoal.amount) * 100 : 0
    return { currentValue: current, progressPercentage: Math.min(percentage, 100), goalType: monthlyGoal.type === 'revenue' ? 'Faturamento' : 'Lucro Líquido', goalAmount: monthlyGoal.amount }
  }, [sales, expenses, monthlyGoal])

  if (!monthlyGoal) {
    return (
      <div>
        {showTitle && <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">🎯 Meta do Mês</h3>}
        <p className="text-gray-500 dark:text-gray-400">Nenhuma meta definida para este mês. Vá para a aba 'Metas' para criar uma.</p>
      </div>
    )
  }

  return (
    <div>
      {showTitle && <h3 className="text-xl font-semibold mb-2 text-gray-700 dark:text-gray-200">🎯 Meta do Mês ({goalType})</h3>}
      <div className="flex justify-between items-end mb-1">
        <span className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatCurrency(currentValue)}</span>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">de {formatCurrency(goalAmount)}</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 shadow-inner">
        <div className="bg-purple-500 h-4 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
      </div>
      <p className="text-right text-sm text-gray-600 dark:text-gray-300 mt-1">{progressPercentage.toFixed(1)}% alcançado</p>
    </div>
  )
}

export default GoalProgressBar
