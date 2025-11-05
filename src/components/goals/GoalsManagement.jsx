import React, { useState, useMemo, useEffect } from 'react'
import CustomModal from '../ui/CustomModal'
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore'
import { getUserCollectionPath } from '../../utils/paths'
import { formatCurrency, formatNumber, getStartOfDay } from '../../utils/format'
import { toJSDate } from '../../utils/dates'

const cardStyle = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700'
const primaryColor = 'bg-pink-500 hover:bg-pink-600'
const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 transition duration-150 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'

const GoalPacingChart = ({ goal, sales, expenses, goalTypes }) => {
  const data = useMemo(() => {
    if (!goal) return { idealPath: [], actualPath: [], daysInMonth: 0, today: 0 };
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = now.getDate();
    const idealDailyValue = goal.amount / daysInMonth;
    const idealPath = Array.from({length: daysInMonth}, (_, i) => idealDailyValue * (i + 1));

  const monthSales = (sales || []).filter(s => { const d = toJSDate(s.date); return d ? (d.getMonth() === month && d.getFullYear() === year && s.status !== 'estornada') : false });
  const monthExpenses = (expenses || []).filter(e => { const d = toJSDate(e.date); return d ? (d.getMonth() === month && d.getFullYear() === year && e.status === 'pago') : false });

    const dailyValues = Array(daysInMonth).fill(0);
    switch(goal.type) {
      case 'revenue':
      case 'averageTicket':
  monthSales.forEach(s => { const d = toJSDate(s.date); if (!d) return; dailyValues[d.getDate() - 1] += s.totalAmount || s.finalTotal || 0; });
        break;
      case 'netProfit':
  monthSales.forEach(s => { const d = toJSDate(s.date); if (!d) return; dailyValues[d.getDate() - 1] += s.profit || 0; });
  monthExpenses.forEach(e => { const d = toJSDate(e.date); if (!d) return; dailyValues[d.getDate() - 1] -= e.amount; });
        break;
      case 'salesCount':
  monthSales.forEach(s => { const d = toJSDate(s.date); if (!d) return; dailyValues[d.getDate() - 1] += 1; });
        break;
      case 'itemsSold':
  monthSales.forEach(s => { const d = toJSDate(s.date); if (!d) return; const idx = d.getDate() - 1; dailyValues[idx] += s.items.reduce((sum,i)=>sum+i.quantity,0); });
        break;
      default: break;
    }

  let sum = 0;
  const actualPath = dailyValues.map((v, i) => { sum += v; if (goal.type === 'averageTicket') { const salesUpToDay = monthSales.filter(s => { const d = toJSDate(s.date); return d ? d.getDate() <= i + 1 : false }); return salesUpToDay.length > 0 ? sum / salesUpToDay.length : 0 } return sum; });

    return { idealPath, actualPath, daysInMonth, today };
  }, [goal, sales, expenses]);

  const { idealPath, actualPath, daysInMonth, today } = data;
  const maxValue = Math.max(...idealPath, ...actualPath, goal.amount || 0);
  if (maxValue === 0) return <p>Sem dados para exibir.</p>;

  const width = 500; const height = 200;
  const toPathString = (pathData) => pathData.map((val,i) => `${(i/(daysInMonth-1))*width},${height - (val / maxValue) * height}`).join(' ');
  const idealPoints = toPathString(idealPath);
  const actualPoints = toPathString(actualPath.slice(0, today));

  return (
    <div className="text-center">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        <polyline fill="none" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" points={idealPoints} />
        <polyline fill="none" stroke="#ec4899" strokeWidth="3" points={actualPoints} />
      </svg>
      <div className="flex justify-center items-center space-x-4 text-sm mt-2"><div className="flex items-center"><span className="w-4 h-0.5 bg-pink-500 mr-2"></span> Realizado</div><div className="flex items-center"><span className="w-4 h-0.5 bg-gray-300 border-t-2 border-dashed border-gray-300 mr-2"></span> Ideal</div></div>
      <p className="text-sm mt-2">Valor atual: <strong className="text-pink-600">{formatCurrency(actualPath[today - 1] || 0)}</strong></p>
    </div>
  )
}

const GoalsManagement = ({ db, userId, sales = [], expenses = [], allGoals = [], showToast = () => {} }) => {
  const now = new Date();
  const currentMonthId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`;
  const currentMonthGoal = allGoals.find(g => g.id === currentMonthId);

  const [goalType, setGoalType] = useState('revenue');
  const [goalAmount, setGoalAmount] = useState('');

  const goalTypes = [
    { value: 'revenue', label: 'Faturamento (Receita Total)', format: formatCurrency },
    { value: 'netProfit', label: 'Lucro Líquido', format: formatCurrency },
    { value: 'salesCount', label: 'Número de Vendas', format: formatNumber },
    { value: 'itemsSold', label: 'Itens Vendidos', format: formatNumber },
    { value: 'averageTicket', label: 'Ticket Médio (R$)', format: formatCurrency }
  ];

  useEffect(() => {
    if (currentMonthGoal) { setGoalType(currentMonthGoal.type); setGoalAmount(currentMonthGoal.amount); } else { setGoalType('revenue'); setGoalAmount(''); }
  }, [currentMonthGoal]);

  const handleSaveGoal = async () => {
    const amount = parseFloat(goalAmount);
    if (!db || !userId || isNaN(amount) || amount <= 0) { showToast('Por favor, insira um valor de meta válido.', 'error'); return; }
    const goalRef = doc(db, getUserCollectionPath(userId, 'goals'), currentMonthId);
    try { await setDoc(goalRef, { type: goalType, amount }); showToast('Meta salva com sucesso!', 'success'); } catch (error) { console.error('Erro ao salvar meta:', error); showToast('Erro ao salvar a meta.', 'error'); }
  };

  const calculatePerformance = (goal, allSales, allExpenses) => {
    if (!goal) return { achieved: 0, percentage: 0 };
    const [year, month] = goal.id.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
  const monthSales = (allSales || []).filter(s => { const sd = toJSDate(s.date); return sd ? (sd >= startOfMonth && sd <= endOfMonth && s.status !== 'estornada') : false; });
  const monthExpenses = (allExpenses || []).filter(e => { const ed = toJSDate(e.date); return ed ? (ed >= startOfMonth && ed <= endOfMonth && e.status === 'pago') : false; });
    let achievedValue = 0; const totalRevenue = monthSales.reduce((sum,s)=>sum + s.totalAmount,0);
    switch(goal.type) { case 'revenue': achievedValue = totalRevenue; break; case 'netProfit': const grossProfit = monthSales.reduce((sum,s)=>sum + (s.profit||0),0); const totalExpenses = monthExpenses.reduce((sum,e)=>sum + e.amount,0); achievedValue = grossProfit - totalExpenses; break; case 'salesCount': achievedValue = monthSales.length; break; case 'itemsSold': achievedValue = monthSales.reduce((sum,s)=>sum + s.items.reduce((iSum,i)=>iSum + i.quantity,0),0); break; case 'averageTicket': achievedValue = monthSales.length > 0 ? totalRevenue / monthSales.length : 0; break; default: achievedValue = 0; }
    const percentage = goal.amount > 0 ? (achievedValue / goal.amount) * 100 : 0;
    return { achieved: achievedValue, percentage };
  };

  const historicalGoals = useMemo(() => (allGoals || []).filter(g => g.id !== currentMonthId).sort((a,b)=>b.id.localeCompare(a.id)), [allGoals, currentMonthId]);

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Metas e Objetivos</h2>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className={cardStyle}>
          <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Definir Meta para {new Date().toLocaleDateString('pt-BR', {month: 'long'})}</h3>
          <div className="space-y-4">
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tipo de Meta</label><select value={goalType} onChange={e=>setGoalType(e.target.value)} className={inputStyle}>{goalTypes.map(t=> <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Valor da Meta</label><input type="number" value={goalAmount} onChange={e=>setGoalAmount(e.target.value)} className={inputStyle} placeholder="Ex: 5000"/></div>
            <button onClick={handleSaveGoal} className={`w-full p-3 rounded-full text-white font-bold ${primaryColor}`}>{currentMonthGoal ? 'Atualizar Meta' : 'Salvar Meta'}</button>
          </div>
        </div>
        <div className={cardStyle}>
          <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Ritmo para Atingir a Meta</h3>
          {currentMonthGoal ? <GoalPacingChart goal={currentMonthGoal} sales={sales} expenses={expenses} goalTypes={goalTypes} /> : <p className="text-center text-gray-500 dark:text-gray-400 py-10">Defina uma meta para ver o ritmo de progresso.</p>}
        </div>
      </div>
      <div className={cardStyle}>
        <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Histórico de Metas</h3>
        <div className="max-h-96 overflow-y-auto">
          <ul className="space-y-3">
            {historicalGoals.map(goal => { const perf = calculatePerformance(goal, sales, expenses); const cfg = goalTypes.find(gt => gt.value === goal.type) || { format: formatNumber }; const isAchieved = perf.percentage >= 100; const [year, month] = goal.id.split('-'); const monthName = new Date(year, month-1,1).toLocaleDateString('pt-BR', {month: 'long'});
              return (<li key={goal.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border dark:border-gray-600"><p className="font-bold text-gray-800 dark:text-gray-200 capitalize">{monthName} de {year}</p><div className="flex justify-between items-center mt-1"><div><p className="text-sm text-gray-500 dark:text-gray-400">Meta ({cfg.label}): {cfg.format(goal.amount)}</p><p className="text-sm text-gray-500 dark:text-gray-400">Atingido: <span className="font-semibold">{cfg.format(perf.achieved)}</span></p></div><div className={`px-3 py-1 rounded-full text-sm font-bold ${isAchieved ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>{perf.percentage.toFixed(1)}% {isAchieved ? '✅' : '❌'}</div></div></li>)} )}
          </ul>
        </div>
      </div>
    </div>
  )
}

export default GoalsManagement
