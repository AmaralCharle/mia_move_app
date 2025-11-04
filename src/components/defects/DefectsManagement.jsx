import React, { useState, useMemo, useEffect } from 'react'
import CustomModal from '../ui/CustomModal'
import { writeBatch, doc, collection, Timestamp, deleteDoc } from 'firebase/firestore'
import { getUserCollectionPath } from '../../utils/paths'
import { formatCurrency } from '../../utils/format'

const primaryColor = 'bg-pink-500 hover:bg-pink-600'
const dangerColor = 'bg-red-500 hover:bg-red-600'
const cardStyle = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700'
const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 transition duration-150 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'

const DefectsManagement = ({ db, userId, products = null, defectiveItems = null, showToast = () => {} }) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVariant, setSelectedVariant] = useState(null)
  const [defectDescription, setDefectDescription] = useState('')
  const [suggestedAction, setSuggestedAction] = useState('')
  const [itemToResolve, setItemToResolve] = useState(null)
  const [isResolving, setIsResolving] = useState(false)

  const hasDb = !!db && !!userId

  // products list should come from props (Firestore-driven). No demo/localStorage fallback.
  const productsList = Array.isArray(products) ? products : []

  // use provided defectiveItems (from parent) or empty array
  const defectsList = defectiveItems && Array.isArray(defectiveItems) ? defectiveItems : []

  const availableVariants = useMemo(() => {
    return (productsList || []).flatMap(p => (p.variants || []).map(v => ({ ...v, productId: p.id, productName: p.name })))
      .filter(v => v.quantity > 0 && (v.productName.toLowerCase().includes(searchTerm.toLowerCase()) || v.sku.toLowerCase().includes(searchTerm.toLowerCase())))
  }, [productsList, searchTerm])

  const openModal = () => {
    setIsModalOpen(true)
    setSelectedVariant(null)
    setDefectDescription('')
    setSuggestedAction('')
    setSearchTerm('')
  }

  const handleSaveDefective = async () => {
    if (!selectedVariant || !defectDescription.trim()) {
      showToast('Selecione um produto e descreva o defeito.', 'error')
      return
    }

    if (!hasDb) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      return
    }

    if (hasDb) {
      try {
        const batch = writeBatch(db)
        const parentProduct = products.find(p => p.id === selectedVariant.productId)
        if (!parentProduct) { showToast('Produto original não encontrado.', 'error'); return }
        const productRef = doc(db, getUserCollectionPath(userId, 'products'), selectedVariant.productId)
        const variantIndex = parentProduct.variants.findIndex(v => v.sku === selectedVariant.sku)
        const oldQuantity = parentProduct.variants[variantIndex].quantity
        const newQuantity = oldQuantity - 1
        if (newQuantity < 0) { showToast('Estoque insuficiente para registrar o defeito.', 'error'); return }
        const updatedVariants = [...parentProduct.variants]
        updatedVariants[variantIndex].quantity = newQuantity
        batch.update(productRef, { variants: updatedVariants })

        const movementLog = { date: Timestamp.now(), productId: selectedVariant.productId, productName: selectedVariant.productName, variantSku: selectedVariant.sku, type: 'saida_defeito', quantityChange: 1, reason: `Defeito: ${defectDescription.substring(0,30)}...`, oldQuantity, newQuantity }
        batch.set(doc(collection(db, getUserCollectionPath(userId, 'stockMovements'))), movementLog)

        const defectiveItemData = { ...selectedVariant, defectDescription, suggestedAction, registeredAt: Timestamp.now(), status: 'pendente' }
        batch.set(doc(collection(db, getUserCollectionPath(userId, 'defectiveItems'))), defectiveItemData)

        await batch.commit()
        showToast('Item defeituoso registrado com sucesso!', 'success')
        setIsModalOpen(false)
      } catch (error) {
        console.error('Erro ao registrar item defeituoso:', error)
        showToast('Erro ao registrar item defeituoso.', 'error')
      }
      return
    }
  }

  const handleResolve = async () => {
    if (!itemToResolve) return
    setIsResolving(true)
    if (hasDb) {
      try {
        await deleteDoc(doc(db, getUserCollectionPath(userId, 'defectiveItems'), itemToResolve.id))
        showToast('Item defeituoso resolvido e removido da lista.', 'success')
      } catch (error) { console.error(error); showToast('Erro ao resolver o item.', 'error') }
      finally { setItemToResolve(null); setIsResolving(false) }
      return
    }

    // No demo fallback: require Firestore
    showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
    setItemToResolve(null)
    setIsResolving(false)
  }

  const handleShareToWhatsApp = (item) => {
    const message = `*Relatório de Defeito - Mia Move*\n\n` +
      `*Produto:* ${item.productName}\n` +
      `*Variação:* ${item.size} - ${item.color}\n` +
      `*SKU:* ${item.sku}\n\n` +
      `*Defeito Descrito:*\n${item.defectDescription}\n\n` +
      `*Ação Sugerida:*\n${item.suggestedAction || 'Nenhuma'}`
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  // No local storage sync: defects are provided by Firestore via parent subscriptions

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Controle de Defeitos</h2>
        <button onClick={openModal} className={`px-4 py-3 text-white font-semibold rounded-lg ${primaryColor} shadow-md`}>+ Registrar Defeito</button>
      </div>

      <div className={cardStyle}>
        <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Itens com Defeito ({(defectsList || []).length})</h3>
        <div className="space-y-4">
          {(defectsList || []).map(item => (
            <div key={item.id} className="p-4 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <div className="flex flex-col sm:flex-row justify-between sm:items-start">
                <div>
                  <p className="font-bold text-lg dark:text-gray-100">{item.productName} ({item.size} - {item.color})</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">SKU: {item.sku} | Registrado em: {item.registeredAt ? (new Date(item.registeredAt).toLocaleDateString('pt-BR')) : 'N/A'}</p>
                </div>
                <div className="flex items-center space-x-2 mt-3 sm:mt-0">
                  <button onClick={() => handleShareToWhatsApp(item)} className="px-3 py-1 text-sm text-white font-semibold rounded-full bg-green-500 hover:bg-green-600 flex items-center space-x-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.428A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    <span>WhatsApp</span>
                  </button>
                  <button onClick={() => setItemToResolve(item)} className={`px-3 py-1 text-sm text-white font-semibold rounded-full ${dangerColor}`}>Resolver</button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t dark:border-gray-600 text-sm space-y-2">
                <p><strong>Defeito:</strong> {item.defectDescription}</p>
                <p><strong>Ação Sugerida:</strong> {item.suggestedAction || 'N/A'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CustomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Registrar Item com Defeito" size="max-w-2xl"
        actions={<>
          <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-full">Cancelar</button>
          <button onClick={handleSaveDefective} className={`px-4 py-2 text-white rounded-full ${primaryColor}`}>Registrar e Dar Baixa</button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">1. Encontre o Produto em Estoque</label>
            <input type="text" placeholder="Buscar por nome ou SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={inputStyle} />
            <div className="max-h-40 overflow-y-auto mt-2 space-y-1 pr-2">
              {searchTerm && availableVariants.map(v => (
                <button key={v.sku} onClick={() => { setSelectedVariant(v); setSearchTerm('') }} className="w-full text-left p-2 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/40">
                  {v.productName} ({v.size} - {v.color}) - Estoque: {v.quantity}
                </button>
              ))}
            </div>
          </div>
          {selectedVariant && (
            <div className="p-3 bg-teal-50 dark:bg-teal-900/40 rounded-lg">
              <p className="font-semibold text-teal-800 dark:text-teal-200">Selecionado: {selectedVariant.productName} ({selectedVariant.size} - {selectedVariant.color})</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">2. Descreva o Defeito</label>
            <textarea value={defectDescription} onChange={e => setDefectDescription(e.target.value)} rows="3" className={inputStyle} placeholder="Ex: Costura solta na manga direita."></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium">3. Ação Sugerida (Opcional)</label>
            <input type="text" value={suggestedAction} onChange={e => setSuggestedAction(e.target.value)} className={inputStyle} placeholder="Ex: Trocar com fornecedor." />
          </div>
        </div>
      </CustomModal>

      <CustomModal isOpen={!!itemToResolve} onClose={() => setItemToResolve(null)} title="Confirmar Resolução" size="max-w-md"
        actions={<>
          <button onClick={() => setItemToResolve(null)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-full">Cancelar</button>
          <button onClick={handleResolve} disabled={isResolving} className={`px-4 py-2 text-white rounded-full ${dangerColor} disabled:opacity-50`}>{isResolving ? 'Resolvendo...' : 'Confirmar e Remover'}</button>
        </>}>
        <p>Tem certeza que deseja marcar o item <strong>{itemToResolve?.productName} ({itemToResolve?.size} - {itemToResolve?.color})</strong> como resolvido?</p>
        <p className="text-sm text-gray-500 mt-2">Esta ação irá remover o item permanentemente da lista de defeitos.</p>
      </CustomModal>
    </div>
  )
}

export default DefectsManagement
