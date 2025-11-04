import React, { useState, useEffect } from 'react'
import CustomModal from '../ui/CustomModal'

const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 transition duration-150 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'

const AdjustStockModal = ({ isOpen, onClose, variant, onAdjust }) => {
  const [newQuantity, setNewQuantity] = useState(variant?.quantity || 0)
  const [reason, setReason] = useState('')
  const reasons = ["Avaria", "Perda", "Acerto de contagem", "Devolução", "Outro"]

  useEffect(() => {
    setNewQuantity(variant?.quantity || 0)
    setReason('')
  }, [variant, isOpen])

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={`Ajustar Estoque: ${variant?.productName || ''}`} size="max-w-md"
      actions={<>
  <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-full">Cancelar</button>
        <button onClick={() => onAdjust(parseInt(newQuantity, 10), reason)} className="px-4 py-2 text-white rounded-full bg-pink-500">Confirmar Ajuste</button>
      </>}>
      <div className="space-y-4">
        <p>Variação: <strong>{variant?.size} - {variant?.color}</strong> (SKU: {variant?.sku})</p>
        <p>Quantidade Atual: <strong>{variant?.quantity}</strong></p>
        <div>
          <label className="block text-sm font-medium">Nova Quantidade:</label>
          <input type="number" value={newQuantity} onChange={(e) => setNewQuantity(e.target.value)} className={inputStyle} min="0" />
        </div>
        <div>
          <label className="block text-sm font-medium">Motivo do Ajuste:</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputStyle}>
            <option value="">Selecione um motivo</option>
            {reasons.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>
    </CustomModal>
  )
}

export default AdjustStockModal
