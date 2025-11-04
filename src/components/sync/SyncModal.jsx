import React, { useState } from 'react'
import CustomModal from '../ui/CustomModal'
import { copyToClipboard } from '../../utils/clipboard'

const SyncModal = ({ isOpen, onClose, showToast, onSync, onUnsync, currentUid, isSynced }) => {
  const [pastedUid, setPastedUid] = useState('')

  const handleCopy = async () => {
    try {
      await copyToClipboard(currentUid || '')
      showToast('ID da Sessão copiado!', 'success')
    } catch (err) {
      showToast('Falha ao copiar o ID.', 'error')
    }
  }

  const handleSyncWithUid = () => {
    if (!pastedUid.trim()) return showToast('Por favor, cole um ID para sincronizar.', 'error')
    onSync(pastedUid.trim())
    onClose()
  }

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Sincronizar Dispositivos" size="max-w-xl">
      <div className="space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">Use esta função para acessar os mesmos dados em diferentes aparelhos.</p>
        <div className="p-4 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <h4 className="font-semibold text-lg mb-2">1. Copie o ID do Dispositivo Principal</h4>
          <div className="mt-4 text-center bg-pink-100 dark:bg-pink-900/40 p-3 rounded-lg flex items-center justify-between">
            <span className="text-sm font-mono break-all text-pink-800 dark:text-pink-200">{currentUid}</span>
            <button onClick={handleCopy} className="ml-4 px-3 py-2 text-sm font-semibold bg-pink-500 text-white rounded-lg hover:bg-pink-600">Copiar</button>
          </div>
        </div>
        <div className="p-4 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
          <h4 className="font-semibold text-lg mb-2">2. Cole o ID no Novo Dispositivo</h4>
          <div className="flex space-x-2">
            <input type="text" value={pastedUid} onChange={(e) => setPastedUid(e.target.value)} placeholder="Cole o ID da Sessão aqui" className="w-full p-3 border border-gray-300 rounded-lg" />
            <button onClick={handleSyncWithUid} className="px-6 py-2 font-semibold text-white rounded-lg bg-teal-500 hover:bg-teal-600">Sincronizar</button>
          </div>
        </div>
        {isSynced && (
          <div className="text-center pt-4 border-t">
            <button onClick={onUnsync} className="px-4 py-2 text-sm font-semibold rounded-full bg-red-500 text-white">Desfazer Sincronização neste Dispositivo</button>
          </div>
        )}
      </div>
    </CustomModal>
  )
}

export default SyncModal
