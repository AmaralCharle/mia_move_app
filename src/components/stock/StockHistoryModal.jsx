import React from 'react'
import CustomModal from '../ui/CustomModal'

const StockHistoryModal = ({ isOpen, onClose, variant, movements = [] }) => {
  const getTypeLabel = (type) => {
    switch(type) {
      case 'venda': return <span className="text-red-600 font-semibold">Venda</span>
      case 'estorno': return <span className="text-blue-600 font-semibold">Estorno</span>
      case 'ajuste_entrada': return <span className="text-green-600 font-semibold">Ajuste (Entrada)</span>
      case 'ajuste_saida': return <span className="text-orange-600 font-semibold">Ajuste (Saída)</span>
      case 'saida_defeito': return <span className="text-yellow-600 font-semibold">Saída (Defeito)</span>
      default: return type
    }
  }

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={`Histórico: ${variant?.productName || ''} (${variant?.size || ''} - ${variant?.color || ''})`} size="max-w-2xl">
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Data</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tipo</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Alteração</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Saldo Final</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Motivo / Venda ID</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {movements.map((mov, index) => (
              <tr key={index}>
                <td className="px-3 py-4 text-sm">{mov.date.toDate().toLocaleString('pt-BR')}</td>
                <td className="px-3 py-4 text-sm">{getTypeLabel(mov.type)}</td>
                <td className={`px-3 py-4 text-sm font-bold ${mov.type === 'ajuste_entrada' || mov.type === 'estorno' ? 'text-green-600' : 'text-red-600'}`}>{mov.type === 'ajuste_entrada' || mov.type === 'estorno' ? `+${mov.quantityChange}` : `-${mov.quantityChange}`}</td>
                <td className="px-3 py-4 text-sm font-bold">{mov.newQuantity}</td>
                <td className="px-3 py-4 text-sm">{mov.reason || mov.saleId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CustomModal>
  )
}

export default StockHistoryModal
