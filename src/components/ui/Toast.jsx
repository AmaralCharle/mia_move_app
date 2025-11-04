import React from 'react'

const Toast = ({ message, type, onClose }) => {
  const baseStyle = "fixed bottom-5 right-5 p-4 rounded-lg shadow-xl text-white font-semibold flex items-center space-x-3 transition-opacity duration-300 z-50"
  let typeStyle = ''

  switch (type) {
    case 'success': typeStyle = 'bg-teal-500'; break
    case 'error': typeStyle = 'bg-red-500'; break
    default: typeStyle = 'bg-gray-700'
  }

  return (
    <div className={`${baseStyle} ${typeStyle}`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 opacity-75 hover:opacity-100">&times;</button>
    </div>
  )
}

export default Toast
