import React, { useMemo, useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { getUserCollectionPath } from '../../utils/paths'

// Props:
// - variants: array of variant objects (must include `sku` and `quantity`)
// - db, userId (optional): when provided, component will fetch `stockMovements` and compute
//   a baseline per SKU = max(historical quantities, current quantity) for percent-based buckets.
// - mediumThresholdPct, lowThresholdPct (optional): thresholds in percentRemaining (default 50, 10)
const StockLevelChart = ({ variants = [], db = null, userId = null, mediumThresholdPct = 50, lowThresholdPct = 10 }) => {
  // fallback absolute thresholds while no historical baseline available
  const lowStockThreshold = 5
  const fullStockThreshold = 10

  const [baselines, setBaselines] = useState(null) // map sku -> baseline quantity
  const [loadingBaselines, setLoadingBaselines] = useState(false)

  // compute buckets: if baselines are available, use percentRemaining = quantity / baseline * 100
  const stockLevels = useMemo(() => {
    if (!variants || variants.length === 0) {
      return { full: { count: 0, percentage: 0 }, medium: { count: 0, percentage: 0 }, low: { count: 0, percentage: 0 }, outOfStock: { count: 0, percentage: 0 }, total: 0 }
    }

    let full = 0; let medium = 0; let low = 0; let outOfStock = 0

    variants.forEach(v => {
      const qty = typeof v.quantity === 'number' ? v.quantity : parseInt(v.quantity || 0, 10) || 0
      // out of stock is deterministic
      if (qty === 0) {
        outOfStock++
        return
      }

      // if baselines available and a baseline exists for this SKU, use percent-based rule
      const sku = v.sku || v.SKU || ''
      const baseline = baselines && sku ? baselines[sku] : null
      if (baseline && baseline > 0) {
        const percentRemaining = (qty / baseline) * 100
        if (percentRemaining <= lowThresholdPct) low++
        else if (percentRemaining <= mediumThresholdPct) medium++
        else full++
      } else {
        // fallback to absolute thresholds
        if (qty < lowStockThreshold) low++
        else if (qty < fullStockThreshold) medium++
        else full++
      }
    })

    const total = variants.length
    return { full: { count: full, percentage: (full / total) * 100 }, medium: { count: medium, percentage: (medium / total) * 100 }, low: { count: low, percentage: (low / total) * 100 }, outOfStock: { count: outOfStock, percentage: (outOfStock / total) * 100 }, total }
  }, [variants, baselines, mediumThresholdPct, lowThresholdPct])

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

  // If db + userId provided, fetch stockMovements once and compute baseline per SKU
  useEffect(() => {
    let cancelled = false
    const loadBaselines = async () => {
      if (!db || !userId) return setBaselines(null)
      setLoadingBaselines(true)
      try {
        const movementsRef = collection(db, getUserCollectionPath(userId, 'stockMovements'))
        const snap = await getDocs(movementsRef)
        const map = {}
        // for each movement, consider oldQuantity and newQuantity for baseline
        snap.forEach(docSnap => {
          const m = docSnap.data()
          const sku = m.variantSku || m.sku || ''
          if (!sku) return
          const oldQ = typeof m.oldQuantity === 'number' ? m.oldQuantity : (m.oldQuantity && m.oldQuantity.seconds ? null : parseInt(m.oldQuantity || 0, 10))
          const newQ = typeof m.newQuantity === 'number' ? m.newQuantity : (m.newQuantity && m.newQuantity.seconds ? null : parseInt(m.newQuantity || 0, 10))
          const candidates = []
          if (oldQ != null && !Number.isNaN(oldQ)) candidates.push(oldQ)
          if (newQ != null && !Number.isNaN(newQ)) candidates.push(newQ)
          if (!map[sku]) map[sku] = 0
          candidates.forEach(c => { if (typeof c === 'number' && c > map[sku]) map[sku] = c })
        })

        // ensure we at least consider current quantities as baseline
        (variants || []).forEach(v => {
          const sku = v.sku || v.SKU || ''
          const qty = typeof v.quantity === 'number' ? v.quantity : parseInt(v.quantity || 0, 10) || 0
          if (!sku) return
          map[sku] = Math.max(map[sku] || 0, qty)
        })

        if (!cancelled) setBaselines(map)
      } catch (e) {
        // if fetch fails, keep baselines null and fallback to absolute thresholds
        console.error('Erro ao carregar stockMovements para baselines:', e)
        if (!cancelled) setBaselines(null)
      } finally {
        if (!cancelled) setLoadingBaselines(false)
      }
    }

    loadBaselines()
    return () => { cancelled = true }
  }, [db, userId, variants])

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
