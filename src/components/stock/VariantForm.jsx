import React from 'react'

const inputStyle = 'w-full p-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50 text-sm'

const VariantForm = ({ variant, index, onChange, onRemove, showRemove, applyToAll }) => {
  const handleChange = (e) => onChange(index, e)

  return (
    <div className="p-3 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 relative">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
        <div><label className="block text-xs font-medium">SKU*:</label><input type="text" name="sku" value={variant.sku} onChange={handleChange} required className={inputStyle} /></div>
        <div><label className="block text-xs font-medium">Tamanho:</label><input type="text" name="size" value={variant.size} onChange={handleChange} className={inputStyle} /></div>
        <div><label className="block text-xs font-medium">Cor:</label><input type="text" name="color" value={variant.color} onChange={handleChange} className={inputStyle} /></div>
        <div><label className="block text-xs font-medium">Qtd*:</label><input type="number" name="quantity" value={variant.quantity} onChange={handleChange} required min="0" className={inputStyle} /></div>
        <div className="flex items-center"><div className="flex-grow"><label className="block text-xs font-medium">Custo (R$):</label><input type="number" name="costPrice" value={variant.costPrice} onChange={handleChange} step="0.01" min="0" className={inputStyle} /></div>{/* apply icon may be rendered by parent */}</div>
        <div className="flex items-center"><div className="flex-grow"><label className="block text-xs font-medium">Venda (R$)*:</label><input type="number" name="salePrice" value={variant.salePrice} onChange={handleChange} required step="0.01" min="0.01" className={inputStyle} /></div>{/* apply icon may be rendered by parent */}</div>
      </div>
      {showRemove && <button type="button" onClick={() => onRemove(index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 text-lg font-bold">&times;</button>}
      {/* render apply-to-all buttons if provided */}
      {applyToAll && applyToAll.show && (
        <div className="absolute top-2 left-2 flex space-x-1">
          {applyToAll.fields.map(f => (
            <button key={f.key} type="button" title={`Aplicar ${f.label} para todos`} onClick={() => applyToAll.onApply(f.key, variant[f.key])} className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
              {/* simple icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default VariantForm
