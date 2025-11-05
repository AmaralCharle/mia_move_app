import React, { useState, useEffect, useMemo } from 'react'
import { collection, query, addDoc, updateDoc, deleteDoc, getDocs, writeBatch, doc, Timestamp } from 'firebase/firestore'
import { getUserCollectionPath } from '../../utils/paths'
import CustomModal from '../ui/CustomModal'
import StockLevelChart from '../charts/StockLevelChart'
import VariantForm from './VariantForm'
import AdjustStockModal from './AdjustStockModal'
import StockHistoryModal from './StockHistoryModal'

const primaryColor = 'bg-pink-500 hover:bg-pink-600'
const secondaryColor = 'bg-teal-500 hover:bg-teal-600'
const dangerColor = 'bg-red-500 hover:bg-red-600'
const cardStyle = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700'
const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 transition duration-150 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50 dark:placeholder-gray-400'

const newVariantTemplate = { sku: '', size: '', color: '', quantity: 0, costPrice: 0, salePrice: 0 }

const StockManagement = ({ db, userId, products = [], showToast = () => {}, categories = [] }) => {
  const hasDb = !!db && !!userId
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState(null)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [variantToAdjust, setVariantToAdjust] = useState(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [historyVariant, setHistoryVariant] = useState(null)
  const [variantMovements, setVariantMovements] = useState([])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [formData, setFormData] = useState({ name: '', categoryId: '', variants: [newVariantTemplate] })
  const [bulkColors, setBulkColors] = useState('')
  const [bulkSizes, setBulkSizes] = useState('')
  const [skuPrefix, setSkuPrefix] = useState('')

  useEffect(() => {
    if (editingProduct) {
      setFormData({ name: editingProduct.name || '', categoryId: editingProduct.categoryId || '', variants: editingProduct.variants && editingProduct.variants.length > 0 ? editingProduct.variants : [newVariantTemplate] })
    } else {
      setFormData({ name: '', categoryId: '', variants: [newVariantTemplate] })
    }
  }, [editingProduct])

  // categories are provided by the parent (App) via props and come from a realtime onSnapshot.
  // Use the `categories` prop as the single source of truth to avoid duplicated entries caused
  // by optimistic local updates + snapshot updates.

  const handleBaseChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleVariantChange = (index, e) => {
    const { name, value } = e.target
    const updatedVariants = [...formData.variants]
    updatedVariants[index] = { ...updatedVariants[index], [name]: value }
    setFormData(prev => ({ ...prev, variants: updatedVariants }))
  }

  const addVariant = () => setFormData(prev => ({ ...prev, variants: [...prev.variants, newVariantTemplate] }))
  const removeVariant = (index) => setFormData(prev => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }))

  const handleApplyToAll = (field, value) => {
    setFormData(prev => ({ ...prev, variants: prev.variants.map(v => ({ ...v, [field]: value })) }))
  }

  const handleGenerateVariants = () => {
    const colors = bulkColors.split(',').map(s => s.trim()).filter(Boolean)
    const sizes = bulkSizes.split(',').map(s => s.trim()).filter(Boolean)

    if (colors.length === 0 && sizes.length === 0) {
      return showToast('Informe cores e/ou tamanhos para gerar variações.', 'error')
    }

    const combos = []
    if (colors.length > 0 && sizes.length > 0) {
      colors.forEach(color => sizes.forEach(size => combos.push({ color, size })))
    } else if (colors.length > 0) {
      colors.forEach(color => combos.push({ color, size: '' }))
    } else if (sizes.length > 0) {
      sizes.forEach(size => combos.push({ color: '', size }))
    }

    const variants = combos.map((c, i) => {
      const idx = String(i + 1).padStart(3, '0')
      const colorCode = c.color ? c.color.replace(/\s+/g, '').toUpperCase().slice(0,6) : ''
      const sizeCode = c.size ? c.size.replace(/\s+/g, '').toUpperCase().slice(0,6) : ''
      const skuParts = []
      if (skuPrefix) skuParts.push(skuPrefix.replace(/\s+/g, '').toUpperCase())
      if (colorCode) skuParts.push(colorCode)
      if (sizeCode) skuParts.push(sizeCode)
      skuParts.push(idx)
      const sku = skuParts.join('-')
      return { ...newVariantTemplate, sku, color: c.color, size: c.size }
    })

    setFormData(prev => ({ ...prev, variants: variants.length > 0 ? variants : [newVariantTemplate] }))
    showToast('Variações geradas.', 'success')
  }

  const handleSave = async (e) => {
    e.preventDefault()

    // validações de formulário primeiro (independente do backend)
    if (!formData.name.trim()) return showToast('O nome do produto é obrigatório.', 'error')
    if (formData.variants.some(v => !v.sku.trim() || parseFloat(v.salePrice) <= 0)) return showToast('Todas as variações devem ter SKU e Preço de Venda válidos.', 'error')

    if (!hasDb) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      return
    }

    // Firestore flow quando houver db e userId
    const productsRef = collection(db, getUserCollectionPath(userId, 'products'))
    try {
      const dataToSave = { ...formData, variants: formData.variants.map(v => ({ ...v, quantity: parseInt(v.quantity, 10) || 0, costPrice: parseFloat(v.costPrice) || 0, salePrice: parseFloat(v.salePrice) || 0 })), updatedAt: Timestamp.now() }
      if (editingProduct) {
        await updateDoc(doc(productsRef, editingProduct.id), dataToSave)
        showToast('Produto atualizado!', 'success')
      } else {
        await addDoc(productsRef, { ...dataToSave, createdAt: Timestamp.now() })
        showToast('Novo produto adicionado!', 'success')
      }
      setIsModalOpen(false); setEditingProduct(null)
    } catch (error) {
      console.error('Erro ao salvar o produto:', error)
      showToast('Erro ao salvar produto.', 'error')
    }
  }

  const confirmDelete = (product) => { setProductToDelete(product); setIsDeleteModalOpen(true) }
  const handleDelete = async () => {
    if (!productToDelete) return

    if (!hasDb) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      setIsDeleteModalOpen(false); setProductToDelete(null)
      return
    }

    try {
      await deleteDoc(doc(db, getUserCollectionPath(userId, 'products'), productToDelete.id))
      showToast(`Produto ${productToDelete.name} excluído.`, 'success')
    } catch (error) {
      console.error('Erro ao deletar produto:', error)
      showToast('Erro ao deletar produto.', 'error')
    } finally {
      setIsDeleteModalOpen(false); setProductToDelete(null)
    }
  }

  const openModal = (product = null) => { setEditingProduct(product); setIsModalOpen(true) }

  const handleOpenAdjustModal = (variant) => { setVariantToAdjust(variant); setIsAdjustModalOpen(true) }

  const handleOpenHistoryModal = async (variant) => {
    setHistoryVariant(variant)
    if (!hasDb) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      return
    }

    try {
      const movementsRef = collection(db, getUserCollectionPath(userId, 'stockMovements'))
      const q = query(movementsRef)
      const querySnapshot = await getDocs(q)
      const movements = querySnapshot.docs.map(d => d.data()).filter(m => m.variantSku === variant.sku).sort((a,b)=>b.date.seconds - a.date.seconds)
      setVariantMovements(movements)
      setIsHistoryModalOpen(true)
    } catch (error) {
      console.error('Erro ao buscar histórico:', error)
      showToast('Erro ao buscar histórico.', 'error')
    }
  }

  const handleAdjustStock = async (newQuantity, reason) => {
    if (!variantToAdjust || reason.trim() === '') return showToast('Nova quantidade e motivo são obrigatórios.', 'error')

    if (!hasDb) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      return
    }

    // Firestore path
    try {
      const productRef = doc(db, getUserCollectionPath(userId, 'products'), variantToAdjust.productId)
      const parentProduct = products.find(p => p.id === variantToAdjust.productId)
      const variantIndex = parentProduct.variants.findIndex(v => v.sku === variantToAdjust.sku)
      if (variantIndex === -1) return
      const oldQuantity = parentProduct.variants[variantIndex].quantity
      const quantityChange = newQuantity - oldQuantity
      const updatedVariants = [...parentProduct.variants]; updatedVariants[variantIndex].quantity = newQuantity

      const movementLog = { date: Timestamp.now(), productId: variantToAdjust.productId, productName: variantToAdjust.productName, variantSku: variantToAdjust.sku, type: quantityChange > 0 ? 'ajuste_entrada' : 'ajuste_saida', quantityChange: Math.abs(quantityChange), reason, oldQuantity, newQuantity }

      const batch = writeBatch(db)
      batch.update(productRef, { variants: updatedVariants })
      batch.set(doc(collection(db, getUserCollectionPath(userId, 'stockMovements'))), movementLog)
      await batch.commit()
      showToast('Estoque ajustado com sucesso!', 'success')
      setIsAdjustModalOpen(false); setVariantToAdjust(null)
    } catch (error) {
      console.error('Erro ao ajustar estoque:', error)
      showToast('Erro ao ajustar estoque.', 'error')
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return showToast('Preencha o nome da categoria.', 'error')
    const name = newCategoryName.trim()
    if (!hasDb) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      return
    }
    try {
      const colRef = collection(db, getUserCollectionPath(userId, 'categories'))
  await addDoc(colRef, { name, createdAt: Timestamp.now() })
  // rely on parent App onSnapshot to update `categories` prop — do not mutate local state here
      setNewCategoryName('')
      showToast('Categoria adicionada!', 'success')
    } catch (error) {
      console.error('Erro ao adicionar categoria', error)
      showToast('Erro ao adicionar categoria.', 'error')
    }
  }

  const handleDeleteCategory = async (cat) => {
    if (!cat) return
    if (!hasDb) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      return
    }
    try {
  await deleteDoc(doc(db, getUserCollectionPath(userId, 'categories'), cat.id))
  // parent onSnapshot will update the categories prop accordingly
      showToast('Categoria removida!', 'success')
    } catch (error) {
      console.error('Erro ao deletar categoria', error)
      showToast('Erro ao excluir categoria.', 'error')
    }
  }

  const allVariants = useMemo(() => {
    return (products || []).filter(p => categoryFilter === 'all' || p.categoryId === categoryFilter).flatMap(p => (p.variants || []).map(v => ({ ...v, quantity: parseInt(v.quantity, 10) || 0, productId: p.id, productName: p.name, category: (categories || []).find(c => c.id === p.categoryId)?.name || 'Sem Categoria' })))
  }, [products, categories, categoryFilter])

  const lowStockVariants = useMemo(() => allVariants.filter(v => v.quantity < 5), [allVariants])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Estoque Mia Move</h2>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={inputStyle + ' max-w-xs'}>
            <option value="all">Todas as Categorias</option>
            {(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => setIsCategoryModalOpen(true)} className="px-4 py-3 text-pink-600 dark:text-pink-300 font-semibold bg-pink-100 dark:bg-pink-900/40 rounded-lg hover:bg-pink-200 dark:hover:bg-pink-900/60 whitespace-nowrap">Gerenciar Categorias</button>
          <button onClick={() => openModal()} className={`px-4 py-3 text-white font-semibold rounded-lg ${primaryColor} shadow-md whitespace-nowrap`}>+ Novo Produto</button>
        </div>
      </div>

      <StockLevelChart variants={allVariants} db={db} userId={userId} />

      {lowStockVariants.length > 0 && (
        <div className="bg-orange-100 dark:bg-orange-900/40 border-l-4 border-orange-500 p-4 rounded-xl shadow-md"><p className="font-bold text-orange-800 dark:text-orange-200">⚠️ {lowStockVariants.length} Variaçõe(s) com Estoque Baixo!</p></div>
      )}

      <div className={`${cardStyle}`}>
        <h3 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-200">Variações em Estoque ({allVariants.length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Produto / Categoria</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">SKU</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Variação</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Qtd</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Venda</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {allVariants.map((v, index) => {
                const parentProduct = products.find(p => p.id === v.productId)
                return (
                  <tr key={`${v.productId}-${v.sku}-${index}`} className={v.quantity < 5 ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}>
                    <td className="px-3 py-4 text-sm font-medium">{v.productName} <span className="block text-xs text-gray-500 dark:text-gray-400">{v.category}</span></td>
                    <td className="px-3 py-4 text-sm">{v.sku}</td>
                    <td className="px-3 py-4 text-sm text-gray-600 dark:text-gray-300">{v.size} - {v.color}</td>
                    <td className="px-3 py-4 text-sm font-bold">{v.quantity}</td>
                    <td className="px-3 py-4 text-sm font-semibold text-teal-600 dark:text-teal-400">{v.salePrice?.toLocaleString ? v.salePrice.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : `R$ ${v.salePrice}`}</td>
                    <td className="px-3 py-4 text-right text-sm font-medium space-x-2">
                      <button onClick={() => handleOpenHistoryModal(v)} className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100">Histórico</button>
                      <button onClick={() => handleOpenAdjustModal(v)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">Ajustar</button>
                      <button onClick={() => openModal(parentProduct)} className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300">Editar</button>
                      <button onClick={() => confirmDelete(parentProduct)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">Excluir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CustomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'} size="max-w-3xl"
        actions={<>
          <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200 rounded-full">Cancelar</button>
          <button onClick={handleSave} className={`px-5 py-2 text-white rounded-full ${primaryColor}`}>{editingProduct ? 'Salvar Alterações' : 'Adicionar Produto'}</button>
        </>}>
        <form className="space-y-6">
          <div className="p-4 border dark:border-gray-700 rounded-lg grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Nome do Produto:</label>
              <input type="text" name="name" value={formData.name} onChange={handleBaseChange} required className={inputStyle} />
            </div>
            <div>
              <label className="block text-sm font-medium">Categoria:</label>
              <select name="categoryId" value={formData.categoryId} onChange={handleBaseChange} className={inputStyle}><option value="">Selecione uma categoria</option>{(categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
          </div>

          {!editingProduct && (
            <div className="p-4 border dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <h4 className="font-semibold text-lg mb-3 text-gray-700 dark:text-gray-200">Gerador de Variações em Massa</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 items-start">
                <div className="flex flex-col">
                  <label className="block text-sm font-medium mb-2 min-h-[2.1rem] leading-tight">Cores (separadas por vírgula):</label>
                  <input type="text" value={bulkColors} onChange={(e) => setBulkColors(e.target.value)} placeholder="Preto, Azul, Rosa" className={inputStyle + " h-10 text-sm"} />
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-medium mb-2 min-h-[2.1rem] leading-tight">Tamanhos (separadas por vírgula):</label>
                  <input type="text" value={bulkSizes} onChange={(e) => setBulkSizes(e.target.value)} placeholder="P, M, G" className={inputStyle + " h-10 text-sm"} />
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-medium mb-2 min-h-[2.1rem] leading-tight">Prefixo do SKU (Opcional):</label>
                  <input type="text" value={skuPrefix} onChange={(e) => setSkuPrefix(e.target.value)} placeholder="LEG-FLARE" className={inputStyle + " h-10 text-sm"} />
                </div>
              </div>
              <button type="button" onClick={handleGenerateVariants} className={`w-full text-center py-3 text-sm font-semibold text-white rounded-full ${secondaryColor} transition`}>Gerar Variações</button>
            </div>
          )}

          <div className="space-y-4">
            <h4 className="font-semibold text-lg text-gray-700 dark:text-gray-200">Variações do Produto</h4>
            <div className="max-h-[40vh] overflow-y-auto space-y-4 pr-2 border-t border-b py-4 dark:border-gray-700">
              {formData.variants.map((variant, index) => (
                <VariantForm key={index} variant={variant} index={index} onChange={handleVariantChange} onRemove={removeVariant} showRemove={formData.variants.length > 1}
                  applyToAll={index === 0 && formData.variants.length > 1 ? { show: true, fields: [{ key: 'costPrice', label: 'Custo' }, { key: 'salePrice', label: 'Venda' }], onApply: handleApplyToAll } : null} />
              ))}
            </div>
            <button type="button" onClick={addVariant} className="w-full text-center py-2 text-sm font-semibold text-pink-600 dark:text-pink-400 border-2 border-dashed border-pink-300 dark:border-pink-500 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-900/30 transition">+ Adicionar Variação Manualmente</button>
          </div>
        </form>
      </CustomModal>

      <CustomModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" size="max-w-md"
        actions={<>
          <button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-full">Cancelar</button>
          <button onClick={handleDelete} className={`px-4 py-2 text-white rounded-full ${dangerColor}`}>Excluir</button>
        </>}>
        <p>Você tem certeza que deseja deletar o produto <strong>{productToDelete?.name}</strong> e todas as suas variações?</p>
      </CustomModal>

      {variantToAdjust && <AdjustStockModal isOpen={isAdjustModalOpen} onClose={() => setIsAdjustModalOpen(false)} variant={variantToAdjust} onAdjust={handleAdjustStock} />}
      {historyVariant && <StockHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} variant={historyVariant} movements={variantMovements} />}
      <CustomModal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Gerenciar Categorias" size="max-w-md"
        actions={<>
          <button onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-full">Fechar</button>
          <button onClick={() => { handleAddCategory(); }} className={`px-4 py-2 text-white rounded-full ${primaryColor}`}>Adicionar</button>
        </>}>
        <div className="space-y-4">
          <input type="text" placeholder="Nome da nova categoria" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className={inputStyle} />
          <div className="space-y-2">
            {(categories || []).length === 0 && <p className="text-gray-500">Nenhuma categoria cadastrada.</p>}
            {(categories || []).map(cat => (
              <div key={cat.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                <div className="text-sm">{cat.name}</div>
                <div className="space-x-2">
                  <button onClick={() => { setCategoryFilter(cat.id); setIsCategoryModalOpen(false); }} className="text-sm text-teal-600">Selecionar</button>
                  <button onClick={() => handleDeleteCategory(cat)} className="text-sm text-red-600">Excluir</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CustomModal>
    </div>
  )
}

export default StockManagement
