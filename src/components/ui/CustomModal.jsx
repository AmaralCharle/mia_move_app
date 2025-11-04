import React from 'react'

const CustomModal = ({ title, children, isOpen, onClose, actions, size = 'max-w-lg', compact = false }) => {
  if (!isOpen) return null
  const paddingClass = compact ? 'p-4' : 'p-6'
  const radiusClass = compact ? 'rounded-md' : 'rounded-xl'

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-white dark:bg-gray-800 ${radiusClass} w-full ${size} ${paddingClass} shadow-2xl max-h-[90vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-pink-600">{title}</h3>
          <button onClick={onClose} aria-label="Fechar modal" className="text-gray-600 hover:text-gray-800 dark:text-gray-200 dark:hover:text-gray-100 text-2xl">×</button>
        </div>
        <div className="mb-6 overflow-y-auto flex-1 min-h-0">{children}</div>
        {actions && <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">{actions}</div>}
      </div>
    </div>
  )
}

export default CustomModal
