import React from 'react'

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-full">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
    <p className="ml-3 text-gray-600 dark:text-gray-300">Carregando...</p>
  </div>
)

export default LoadingSpinner
