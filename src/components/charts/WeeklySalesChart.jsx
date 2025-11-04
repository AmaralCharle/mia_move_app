import React, { useMemo } from 'react'
import { formatCurrency, getStartOfDay } from '../../utils/format'

const WeeklySalesChart = ({ sales }) => {
  const weeklyData = useMemo(() => {
    const data = []
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const startOfDay = getStartOfDay(date)
      data.push({ day: days[date.getDay()], revenue: 0, date: startOfDay })
    }

    (sales || []).filter(s => s.status !== 'estornada').forEach(sale => {
      const saleDate = getStartOfDay(sale.date.toDate())
      const dayData = data.find(d => d.date.getTime() === saleDate.getTime())
      if (dayData) dayData.revenue += sale.totalAmount
    })

    return data
  }, [sales])

  const maxRevenue = Math.max(...weeklyData.map(d => d.revenue), 0)

  return (
    <div className="flex justify-around items-end h-[200px] p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-700">
      {weeklyData.map((d, index) => (
        <div key={index} className="flex flex-col items-center flex-shrink-0 w-12 text-center">
          <div className="text-xs font-semibold text-pink-600 dark:text-pink-400 mb-1">{formatCurrency(d.revenue)}</div>
          <div style={{ height: `${maxRevenue > 0 ? (d.revenue / maxRevenue) * 120 : 0}px`, minHeight: '2px' }} className="w-8 bg-pink-400 rounded-t-md transition-all duration-500 shadow-md"></div>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">{d.day}</span>
        </div>
      ))}
    </div>
  )
}

export default WeeklySalesChart
