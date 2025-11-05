import React, { useState, useMemo } from 'react'
import { collection, doc, getDoc, getDocs, updateDoc, writeBatch } from 'firebase/firestore'
import CustomModal from '../ui/CustomModal'
import { getUserCollectionPath } from '../../utils/paths'
import { formatCurrency, getStartOfDay } from '../../utils/format'
import { toJSDate } from '../../utils/dates'

const cardStyle = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700'
const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'

const CashFlowChart = ({ sales = [], expenses = [] }) => {
  const data = useMemo(() => {
    const inflow = (sales || []).filter(s => s.paymentStatus === 'recebido' && s.status !== 'estornada').reduce((sum,s)=>sum + s.totalAmount, 0);
    const outflow = (expenses || []).filter(e => e.status === 'pago').reduce((sum,e)=>sum + e.amount,0);
    return { inflow, outflow, balance: inflow - outflow };
  }, [sales, expenses]);
  const maxValue = Math.max(data.inflow, data.outflow, 1);
  return (
    <div className="space-y-4">
      <div className="flex justify-around items-end h-48">
        <div className="flex flex-col items-center"><p className="font-bold text-green-600">{formatCurrency(data.inflow)}</p><div className="w-16 bg-green-400 rounded-t-lg" style={{ height: `${(data.inflow / maxValue) * 150}px` }}></div><p className="text-sm">Entradas</p></div>
        <div className="flex flex-col items-center"><p className="font-bold text-red-600">{formatCurrency(data.outflow)}</p><div className="w-16 bg-red-400 rounded-t-lg" style={{ height: `${(data.outflow / maxValue) * 150}px` }}></div><p className="text-sm">Saídas</p></div>
      </div>
      <div className="text-center border-t pt-3"><p className="text-sm">Saldo do Período</p><p className={`text-2xl font-bold ${data.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(data.balance)}</p></div>
    </div>
  )
}

const ProfitTrendChart = ({ sales = [], expenses = [], dateRange = {} }) => {
  const trendData = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return [];
    const dailyData = new Map();
    const dayCursor = new Date(dateRange.start);
    while (dayCursor <= dateRange.end) { dailyData.set(dayCursor.toISOString().split('T')[0], 0); dayCursor.setDate(dayCursor.getDate() + 1); }
  (sales || []).filter(s => s.status !== 'estornada').forEach(s => { const d = toJSDate(s.date); if (!d) return; const day = d.toISOString().split('T')[0]; if (dailyData.has(day)) dailyData.set(day, dailyData.get(day) + (s.profit || 0)); });
  (expenses || []).forEach(e => { if (e.status !== 'pago') return; const d = toJSDate(e.date); if (!d) return; const day = d.toISOString().split('T')[0]; if (dailyData.has(day)) dailyData.set(day, dailyData.get(day) - e.amount); });
    let cumulative = 0; return Array.from(dailyData.values()).map(v => (cumulative += v, cumulative));
  }, [sales, expenses, dateRange]);
  if (trendData.length === 0) return <p className="text-center">Selecione um período para ver a tendência.</p>;
  const max = Math.max(...trendData, 0); const min = Math.min(...trendData, 0); const range = max - min; const width = 500; const height = 200;
  const calculateY = (value) => range === 0 ? height/2 : height - ((value - min) / range) * height;
  const toPathString = (data) => data.length === 1 ? `0,${calculateY(data[0])} ${width},${calculateY(data[0])}` : data.map((v,i)=>`${(i/(data.length-1))*width},${calculateY(v)}`).join(' ');
  const zeroLineY = calculateY(0);
  return (<div className="text-center"><svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">{(zeroLineY >= 0 && zeroLineY <= height) && <line x1="0" y1={zeroLineY} x2={width} y2={zeroLineY} stroke="#9ca3af" strokeWidth="1" strokeDasharray="4 4" />}<polyline fill="none" stroke="#10b981" strokeWidth="3" points={toPathString(trendData)} /></svg><p className="text-sm mt-2">Lucro líquido acumulado no período.</p></div>);
}

const Reports = ({ sales = [], products = [], expenses = [], db, userId, showToast = () => {} }) => {
  const [timeFilter, setTimeFilter] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false)
  const [collectionsToClear, setCollectionsToClear] = useState({ sales: true, stockMovements: true, expenses: true, goals: false, defectiveItems: false })
  const [isClearing, setIsClearing] = useState(false)

  const { filteredSales, filteredExpenses, dateRange } = useMemo(() => {
    const now = new Date(); let start, end = new Date(); end.setHours(23,59,59,999);
    if (timeFilter === 'custom' && startDate && endDate) { start = getStartOfDay(new Date(startDate.replace(/-/g,'/'))); end = new Date(endDate.replace(/-/g,'/')); end.setHours(23,59,59,999); }
    else if (timeFilter === '30days') { start = new Date(); start.setDate(now.getDate() - 30); start = getStartOfDay(start); }
    else if (timeFilter === 'month') { start = getStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1)); }
    else if (timeFilter === 'year') { start = getStartOfDay(new Date(now.getFullYear(), 0, 1)); } else { start = null; }
  const filterByDate = (items, sourceSales = false) => { if (!start) return items; return items.filter(i => { const itemDate = toJSDate(i.date); if (!itemDate) return false; return itemDate >= start && itemDate <= end; }); };
    return { filteredSales: filterByDate(sales, true), filteredExpenses: filterByDate(expenses), dateRange: { start, end } };
  }, [sales, expenses, timeFilter, startDate, endDate]);

  const getPreviousPeriod = (timeFilter) => {
    const now = new Date(); let start, end; if (timeFilter === 'month') { start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end = new Date(now.getFullYear(), now.getMonth(), 0); } else if (timeFilter === '30days') { start = new Date(); start.setDate(now.getDate() - 60); end = new Date(); end.setDate(now.getDate() - 30); } else if (timeFilter === 'year') { start = new Date(now.getFullYear() - 1, 0, 1); end = new Date(now.getFullYear() - 1, 11, 31); } else return null; return { start: getStartOfDay(start), end };
  };

  const calculateMetrics = (salesData, expensesData) => {
    const salesMetrics = (salesData || []).reduce((acc, sale) => { acc.totalRevenue += sale.totalAmount; acc.totalSalesCount += 1; acc.grossProfit += sale.profit || 0; return acc; }, { totalRevenue: 0, grossProfit: 0, totalSalesCount: 0 });
    const paidExpenses = (expensesData || []).filter(e => e.status === 'pago'); const totalExpenses = paidExpenses.reduce((sum,e)=>sum + e.amount,0); const netProfit = salesMetrics.grossProfit - totalExpenses; return { ...salesMetrics, totalExpenses, netProfit };
  };

  const periodComparison = useMemo(() => {
    const currentMetrics = calculateMetrics(filteredSales, filteredExpenses);
    const prev = getPreviousPeriod(timeFilter);
    if (!prev) return { current: currentMetrics, changes: null };
  const prevSales = (sales || []).filter(s => s.status !== 'estornada' && (() => { const d = toJSDate(s.date); return d ? (d >= prev.start && d <= prev.end) : false })());
  const prevExpenses = (expenses || []).filter(e => (() => { const d = toJSDate(e.date); return d ? (d >= prev.start && d <= prev.end) : false })());
    const previousMetrics = calculateMetrics(prevSales, prevExpenses);
    const calcChange = (c, p) => (p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / p) * 100);
    const changes = { revenue: calcChange(currentMetrics.totalRevenue, previousMetrics.totalRevenue), netProfit: calcChange(currentMetrics.netProfit, previousMetrics.netProfit), salesCount: calcChange(currentMetrics.totalSalesCount, previousMetrics.totalSalesCount) };
    return { current: currentMetrics, changes };
  }, [filteredSales, filteredExpenses, sales, expenses, timeFilter]);

  const { totalRevenue, grossProfit, totalSalesCount, totalExpenses, netProfit } = periodComparison.current || { totalRevenue: 0, grossProfit: 0, totalSalesCount: 0, totalExpenses: 0, netProfit: 0 };

  // Product analyses (ABC, top variants, slow moving) simplified here using filteredSales and products
  const productCurveAnalysis = useMemo(() => {
    if (!filteredSales || filteredSales.length === 0) return { A: [], B: [], C: [] };
    const productRevenue = new Map(); let total = 0;
    filteredSales.forEach(sale => sale.items.forEach(item => { const rev = item.salePrice * item.quantity; productRevenue.set(item.productId, (productRevenue.get(item.productId) || 0) + rev); total += rev; }));
    if (total === 0) return { A: [], B: [], C: [] };
    const productsMap = new Map((products || []).map(p => [p.id, p.name]));
    const sorted = Array.from(productRevenue.entries()).map(([id, rev]) => ({ id, name: productsMap.get(id) || 'Produto', revenue: rev, percentage: (rev / total) * 100 })).sort((a,b)=>b.revenue - a.revenue);
    const curves = { A: [], B: [], C: [] }; let cum = 0; sorted.forEach(p => { cum += p.percentage; if (cum <= 80) curves.A.push(p); else if (cum <= 95) curves.B.push(p); else curves.C.push(p); });
    return curves;
  }, [filteredSales, products]);

  const topSellingVariants = useMemo(() => {
    const variantSales = new Map(); (filteredSales || []).forEach(s => s.items.forEach(item => { const cur = variantSales.get(item.sku) || { quantity:0, revenue:0 }; variantSales.set(item.sku, { quantity: cur.quantity + item.quantity, revenue: cur.revenue + item.salePrice * item.quantity }); }));
    const allVariantsMap = new Map((products || []).flatMap(p => (p.variants || []).map(v => [v.sku, { ...v, productName: p.name }])));
    return Array.from(variantSales.entries()).map(([sku, data]) => ({ sku, ...allVariantsMap.get(sku), ...data })).sort((a,b)=>b.quantity - a.quantity).slice(0,10);
  }, [filteredSales, products]);

  const slowMovingStock = useMemo(() => {
  const lastSaleDateMap = new Map(); (sales || []).forEach(s => { const saleDate = toJSDate(s.date) || new Date(); s.items.forEach(item => { if (!lastSaleDateMap.has(item.sku) || saleDate > lastSaleDateMap.get(item.sku)) lastSaleDateMap.set(item.sku, saleDate); }); });
    const threshold = 120; const thresholdDate = new Date(); thresholdDate.setDate(thresholdDate.getDate() - threshold);
  const allVariants = (products || []).flatMap(p => (p.variants || []).filter(v=>v.quantity>0).map(v => ({ ...v, productName: p.name, createdAt: toJSDate(p.createdAt) })));
    return allVariants.map(variant => { const lastSale = lastSaleDateMap.get(variant.sku); const referenceDate = lastSale || variant.createdAt; const daysSinceLastActivity = referenceDate ? Math.floor((new Date() - referenceDate)/(1000*60*60*24)) : null; return { ...variant, lastSale, daysSinceLastActivity, referenceDate }; }).filter(v => v.referenceDate ? v.referenceDate < thresholdDate : false).sort((a,b)=>a.referenceDate - b.referenceDate);
  }, [sales, products]);

  const pendingReceivables = useMemo(() => {
    const receivables = [];
    (sales || []).filter(s => s.paymentStatus === 'a_receber' && s.status !== 'estornada').forEach(sale => {
      const due = toJSDate(sale.dueDate) || toJSDate(sale.date);
      if (!due) return;
      receivables.push({ id: `${sale.id}-0`, saleId: sale.id, installmentNumber: null, dueDate: due, customerName: sale.customerName || 'N/A', amount: sale.totalAmount || sale.finalTotal || 0 });
    });
    (sales || []).filter(s => s.paymentStatus === 'parcelado' && s.status !== 'estornada' && s.installmentsData).forEach(sale => sale.installmentsData.forEach(inst => { if (inst.status === 'a_receber') { const due = toJSDate(inst.dueDate); if (!due) return; receivables.push({ id: `${sale.id}-${inst.number}`, saleId: sale.id, installmentNumber: inst.number, dueDate: due, customerName: sale.customerName || 'N/A', amount: inst.amount, totalInstallments: sale.installments }); } }));
    return receivables.sort((a,b)=>a.dueDate - b.dueDate);
  }, [sales]);

  const handleMarkAsPaid = async (saleId, installmentNumber) => {
    if (!db || !userId) return showToast('Firebase não configurado para marcar como pago.', 'error');
    const saleRef = doc(db, getUserCollectionPath(userId, 'sales'), saleId);
    if (installmentNumber === null) { await updateDoc(saleRef, { paymentStatus: 'recebido' }); showToast('Venda marcada como recebida!', 'success'); }
    else { const saleDoc = await getDoc(saleRef); if (saleDoc.exists()) { const saleData = saleDoc.data(); const updated = saleData.installmentsData.map(inst => inst.number === installmentNumber ? { ...inst, status: 'recebido' } : inst); const allPaid = updated.every(i => i.status === 'recebido'); await updateDoc(saleRef, { installmentsData: updated, ...(allPaid && { paymentStatus: 'recebido' }) }); showToast(`Parcela ${installmentNumber} marcada como recebida!`, 'success'); } }
  };

  const filterOptions = [{ value: 'month', label: 'Este Mês' }, { value: '30days', label: 'Últimos 30 Dias' }, { value: 'year', label: 'Este Ano' }, { value: 'all', label: 'Todo o Período' }, { value: 'custom', label: 'Personalizado' }];

  const handleExportCSV = () => {
    const headers = ['Data','Tipo','Descrição','Valor','Status'];
    const salesRows = (filteredSales || []).map(s => { const d = toJSDate(s.date); return [(d && d.toISOString()) || '', 'Venda', `Venda para ${s.customerName || 'N/A'}`, s.totalAmount || s.finalTotal || 0, s.paymentStatus]; });
    const expensesRows = (filteredExpenses || []).map(e => { const d = toJSDate(e.date); return [(d && d.toISOString()) || '', 'Despesa', e.description, -e.amount, e.status]; });
    const allRows = [...salesRows, ...expensesRows].sort((a,b)=>new Date(a[0]) - new Date(b[0]));
    const csv = [headers.join(','), ...allRows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.setAttribute('download','relatorio_mia_move.csv'); document.body.appendChild(link); link.click(); document.body.removeChild(link); showToast('Exportação concluída!', 'success');
  };

  const toggleCollection = (key) => setCollectionsToClear(prev => ({ ...prev, [key]: !prev[key] }))

  const deleteCollectionDocs = async (collectionName) => {
    if (!db || !userId) throw new Error('Firestore não configurado')
    const colRef = collection(db, getUserCollectionPath(userId, collectionName))
    const snaps = await getDocs(colRef)
    const docs = snaps.docs
    if (!docs || docs.length === 0) return 0
    let deleted = 0
    // delete in batches of 400
    const batchSize = 400
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = writeBatch(db)
      const chunk = docs.slice(i, i + batchSize)
      chunk.forEach(d => batch.delete(doc(colRef, d.id)))
      await batch.commit()
      deleted += chunk.length
    }
    return deleted
  }

  const handleClearConfirm = async () => {
    // Simple yes/no confirmation flow (called after user clicks "Sim, apagar")
    setIsClearing(true)
    try {
      const toProcess = Object.keys(collectionsToClear).filter(k => collectionsToClear[k])
      let totalDeleted = 0
      for (const col of toProcess) {
        showToast(`Limpando ${col}...`, 'info')
        try {
          const del = await deleteCollectionDocs(col)
          totalDeleted += del
          showToast(`${del} documentos removidos de ${col}`, 'success')
        } catch (e) {
          console.error('Erro limpando', col, e)
          showToast(`Erro ao limpar ${col}`, 'error')
        }
      }
      showToast(`Limpeza concluída. Total removido: ${totalDeleted}`, 'success')
      // notify app to refresh data immediately
      try { window.dispatchEvent(new CustomEvent('mia:reports-cleared', { detail: { userId } })) } catch (e) { /* ignore */ }
      setIsClearModalOpen(false)
    } catch (err) {
      console.error('Erro na limpeza:', err)
      showToast('Erro ao limpar relatórios.', 'error')
    } finally {
      setIsClearing(false)
    }
  }

  const renderComparison = (change) => { if (change === null || isNaN(change)) return <span className="text-xs text-gray-400">s/ comp.</span>; const isPositive = change >=0; const color = isPositive ? 'text-green-500' : 'text-red-500'; return <span className={`text-sm font-bold ${color}`}>{isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%</span>; };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Relatórios e Análises</h2>
        <div className="flex items-center gap-2">
          <select value={timeFilter} onChange={e=>setTimeFilter(e.target.value)} className={inputStyle}>{filterOptions.map(o=> <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          {timeFilter === 'custom' && (<><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className={inputStyle} /><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className={inputStyle} /></>)}
          <button onClick={handleExportCSV} className="px-4 py-3 bg-gray-200 rounded-lg">Exportar CSV</button>
          <button onClick={() => setIsClearModalOpen(true)} className="px-4 py-3 bg-red-200 text-red-800 rounded-lg">Limpar Relatórios</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${cardStyle} border-l-4 border-pink-500`}><p className="text-sm text-gray-500">Receita Total</p><p className="text-2xl font-bold text-pink-600 mt-1">{formatCurrency(totalRevenue)}</p>{periodComparison.changes && <div className="mt-1">{renderComparison(periodComparison.changes.revenue)}</div>}</div>
        <div className={`${cardStyle} border-l-4 border-teal-500`}><p className="text-sm text-gray-500">Lucro Bruto (Vendas)</p><p className="text-2xl font-bold text-teal-600 mt-1">{formatCurrency(grossProfit)}</p></div>
        <div className={`${cardStyle} border-l-4 border-red-500`}><p className="text-sm text-gray-500">Total Despesas (Pagas)</p><p className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(totalExpenses)}</p></div>
        <div className={`${cardStyle} border-l-4 border-green-500 col-span-2 lg:col-span-1`}><p className="text-sm text-gray-500">Lucro Líquido</p><p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(netProfit)}</p>{periodComparison.changes && <div className="mt-1">{renderComparison(periodComparison.changes.netProfit)}</div>}</div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={cardStyle}><h3 className="text-xl font-semibold mb-4">Fluxo de Caixa (Recebido vs. Pago)</h3><CashFlowChart sales={filteredSales} expenses={filteredExpenses} /></div>
        <div className={cardStyle}><h3 className="text-xl font-semibold mb-4">Tendência de Lucro no Período</h3><ProfitTrendChart sales={filteredSales} expenses={filteredExpenses} dateRange={dateRange} /></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={`${cardStyle}`}><h3 className="text-xl font-semibold mb-4">Desempenho por Dia da Semana</h3></div>
        <div className={`${cardStyle}`}><h3 className="text-xl font-semibold mb-4">Distribuição de Pagamentos</h3></div>
      </div>

      <div className={cardStyle}>
        <h3 className="text-xl font-semibold mb-4">Contas a Receber (Geral) ({pendingReceivables.length})</h3>
        <div className="overflow-x-auto max-h-80">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Vencimento</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Cliente / Parcela</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Valor</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Ação</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y">
              {pendingReceivables.map(item => { const isOverdue = item.dueDate < getStartOfDay(new Date()); return (<tr key={item.id} className={isOverdue ? 'bg-red-50' : ''}><td className="px-3 py-4">{item.dueDate.toLocaleDateString('pt-BR')}</td><td className="px-3 py-4">{item.customerName}{item.installmentNumber && <span className="block text-xs">Parcela {item.installmentNumber}/{item.totalInstallments}</span>}</td><td className="px-3 py-4 font-bold text-yellow-600">{formatCurrency(item.amount)}</td><td className="px-3 py-4"><button onClick={() => handleMarkAsPaid(item.saleId, item.installmentNumber)} className="px-3 py-1 text-xs text-white rounded-full bg-green-500">Recebido</button></td></tr>) })}
            </tbody>
          </table>
        </div>
      </div>

      <CustomModal isOpen={isClearModalOpen} onClose={() => setIsClearModalOpen(false)} title="Limpar Relatórios (permanente)" size="max-w-md"
        actions={<>
          <button onClick={() => setIsClearModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-full">Cancelar</button>
          <button onClick={handleClearConfirm} disabled={isClearing} className={`px-4 py-2 text-white rounded-full ${isClearing ? 'bg-gray-400' : 'bg-red-600'}`}>{isClearing ? 'Limpando...' : 'Confirmar Limpeza'}</button>
        </>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Selecione quais coleções deseja apagar permanentemente. Isso removerá documentos do Firestore e NÃO pode ser desfeito.</p>
          <div className="space-y-2">
            <label className="flex items-center"><input type="checkbox" checked={collectionsToClear.sales} onChange={() => toggleCollection('sales')} className="mr-2" /> Vendas (sales)</label>
            <label className="flex items-center"><input type="checkbox" checked={collectionsToClear.stockMovements} onChange={() => toggleCollection('stockMovements')} className="mr-2" /> Movimentos de Estoque (stockMovements)</label>
            <label className="flex items-center"><input type="checkbox" checked={collectionsToClear.expenses} onChange={() => toggleCollection('expenses')} className="mr-2" /> Despesas (expenses)</label>
            <label className="flex items-center"><input type="checkbox" checked={collectionsToClear.goals} onChange={() => toggleCollection('goals')} className="mr-2" /> Metas (goals)</label>
            <label className="flex items-center"><input type="checkbox" checked={collectionsToClear.defectiveItems} onChange={() => toggleCollection('defectiveItems')} className="mr-2" /> Itens Defeituosos (defectiveItems)</label>
          </div>
          <div>
            <p className="text-sm text-red-600 font-semibold">Quer realmente apagar todo o relatório? Esta ação é permanente e irá remover vendas, movimentos de estoque, despesas, metas e itens defeituosos selecionados.</p>
          </div>
        </div>
      </CustomModal>

      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <div className={`${cardStyle} lg:col-span-1`}>
          <h3 className="text-xl font-semibold mb-4">Curva ABC de Produtos</h3>
          <div className="space-y-4">
            {productCurveAnalysis.A.length > 0 ? (
              productCurveAnalysis.A.map(p => (
                <div key={p.id} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-semibold">{formatCurrency(p.revenue)}</span>
                </div>
              ))
            ) : (
              <p>Nenhum dado</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className={cardStyle}>
            <h3 className="text-xl font-semibold mb-4">Top 10 Variações Mais Vendidas</h3>
            <div className="overflow-x-auto max-h-80">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Produto</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Qtd.</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingVariants.map(v => (
                    <tr key={v.sku}>
                      <td className="py-2 px-2">{v.productName} ({v.size} - {v.color})</td>
                      <td className="py-2 px-2 font-bold">{v.quantity}</td>
                      <td className="py-2 px-2 font-semibold text-teal-600">{formatCurrency(v.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={cardStyle}>
            <h3 className="text-xl font-semibold mb-4">Estoque Encalhado (+120 dias)</h3>
            <div className="overflow-x-auto max-h-80">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Produto</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Qtd.</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Última Atividade</th>
                  </tr>
                </thead>
                <tbody>
                  {slowMovingStock.map(v => (
                    <tr key={v.sku}>
                      <td className="py-2 px-2">{v.productName} ({v.size} - {v.color})</td>
                      <td className="py-2 px-2 font-bold">{v.quantity}</td>
                      <td className="py-2 px-2 text-red-600">{v.daysSinceLastActivity} dias atrás</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Reports
