import React, { useMemo } from 'react'
import WeeklySalesChart from '../charts/WeeklySalesChart'
import PaymentDistributionChart from '../charts/PaymentDistributionChart'
import GoalProgressBar from '../charts/GoalProgressBar'
import { formatCurrency } from '../../utils/format'

const primaryColor = 'bg-pink-500 hover:bg-pink-600'
const secondaryColor = 'bg-teal-500 hover:bg-teal-600'
const cardStyle = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700'
const lowStockThreshold = 5

const Dashboard = ({ sales = [], expenses = [], products = [], monthlyGoal = null, setActiveTab = () => {} }) => {
  const today = new Date(); today.setHours(0,0,0,0)

  const { todayRevenue, todayNetProfit } = useMemo(() => {
    const todaySales = sales.filter(s => s.date.toDate() >= today && s.status !== 'estornada')
    const todayExpenses = expenses.filter(e => e.date.toDate() >= today && e.status === 'pago')
    const revenue = todaySales.reduce((sum, s) => sum + s.totalAmount, 0)
    const grossProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0)
    const totalExpenses = todayExpenses.reduce((sum, e) => sum + e.amount, 0)
    const netProfit = grossProfit - totalExpenses
    return { todayRevenue: revenue, todayNetProfit: netProfit }
  }, [sales, expenses])

  const allVariants = useMemo(() => products.flatMap(p => (p.variants || []).map(v => ({ ...v, productName: p.name }))), [products])

  const bestSellers = useMemo(() => {
    const last7Days = new Date(); last7Days.setDate(last7Days.getDate() - 7)
    const startOfPeriod = new Date(last7Days); startOfPeriod.setHours(0,0,0,0)
    const salesInPeriod = sales.filter(s => s.date.toDate() >= startOfPeriod && s.status !== 'estornada')
    const itemsSold = {}
    salesInPeriod.forEach(sale => sale.items.forEach(item => { itemsSold[item.sku] = (itemsSold[item.sku] || 0) + item.quantity }))
    const allVariantsMap = new Map(allVariants.map(v => [v.sku, v]))
    return Object.entries(itemsSold).map(([sku, quantity]) => ({ ...allVariantsMap.get(sku), quantitySold: quantity })).filter(item => item && item.productName).sort((a,b)=>b.quantitySold-a.quantitySold).slice(0,3)
  }, [sales, allVariants])

  const lowStockVariants = useMemo(() => allVariants.filter(v => v.quantity < 5), [allVariants])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Painel de Controle</h2>
        <p className="text-gray-500 dark:text-gray-400">Resumo do seu negócio hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className={`${cardStyle} border-l-4 border-pink-500 col-span-1 md:col-span-2`}>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Visão Geral do Dia</p>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-bold text-pink-600">{formatCurrency(todayRevenue)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Vendas Hoje</p>
            </div>
            <div>
              <p className={`text-3xl font-bold ${todayNetProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(todayNetProfit)}</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">Lucro Líquido Hoje</p>
            </div>
          </div>
        </div>

        <div className={`${cardStyle} border-l-4 border-purple-500 col-span-1 md:col-span-2`}>
          <GoalProgressBar sales={sales} expenses={expenses} monthlyGoal={monthlyGoal} showTitle={true} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">📈 Desempenho da Semana</h3>
            <WeeklySalesChart sales={sales} />
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">🔥 Produtos Quentes (Últimos 7 dias)</h3>
            {bestSellers.length > 0 ? (
              <ul className="space-y-3">
                {bestSellers.map(item => (
                  <li key={item.sku} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-l-4 border-pink-300 dark:border-pink-500">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{item.productName} ({item.size} - {item.color})</span>
                    <span className="font-bold text-pink-600 dark:text-pink-400">{item.quantitySold} uni.</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">Nenhuma venda nos últimos 7 dias.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">⚠️ Avisos Importantes</h3>
            <div className="space-y-3">
              {lowStockVariants.length > 0 && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/40 rounded-lg flex justify-between items-center">
                  <p className="text-orange-700 dark:text-orange-300 text-sm">{lowStockVariants.length} variaçõe(s) com estoque baixo.</p>
                  <button onClick={() => setActiveTab('Estoque')} className="text-sm font-semibold text-orange-800 dark:text-orange-200 hover:underline">Ver</button>
                </div>
              )}
              {lowStockVariants.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400">Tudo em ordem por aqui!</p>
              )}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700">
            <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">🚀 Acesso Rápido</h3>
            <div className="space-y-3">
              <button onClick={() => setActiveTab('Vendas')} className={`w-full text-center p-4 rounded-lg text-white font-bold ${primaryColor}`}>+ Nova Venda</button>
              <button onClick={() => setActiveTab('Clientes')} className="w-full text-center p-4 rounded-lg text-white font-bold bg-purple-500 hover:bg-purple-600">+ Nova Cliente</button>
              <button onClick={() => setActiveTab('Despesas')} className={`w-full text-center p-4 rounded-lg text-white font-bold ${secondaryColor}`}>+ Nova Despesa</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
