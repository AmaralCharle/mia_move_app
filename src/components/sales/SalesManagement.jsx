import React, { useState, useMemo } from 'react'
import { formatCurrency } from '../../utils/format'
import { collection, addDoc, writeBatch, doc, getDoc } from 'firebase/firestore'
import { getUserCollectionPath } from '../../utils/paths'
import { Timestamp } from 'firebase/firestore'

const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 transition duration-150 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'
const cardStyle = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700'

const SalesManagement = ({ db, userId, products = [], sales = [], customers = [], showToast = () => {} }) => {
  const [view, setView] = useState('new')
  const [historySearch, setHistorySearch] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Cartão de Crédito')
  const [discountPercentage, setDiscountPercentage] = useState(0)
  const [creditCardFee, setCreditCardFee] = useState(0)
  const [installments, setInstallments] = useState(1)
  const [paymentStatus, setPaymentStatus] = useState('recebido')
  const [dueDate, setDueDate] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [saleNotes, setSaleNotes] = useState('')
  const [customerWhatsapp, setCustomerWhatsapp] = useState('')

  const availableVariants = useMemo(() => {
    return (products || []).flatMap(p => (p.variants || []).map(v => ({ ...v, productId: p.id, productName: p.name }))).filter(v => (
      v.productName.toLowerCase().includes(searchTerm.toLowerCase()) || v.color.toLowerCase().includes(searchTerm.toLowerCase()) || v.size.toLowerCase().includes(searchTerm.toLowerCase()) || v.sku.toLowerCase().includes(searchTerm.toLowerCase())
    ))
  }, [products, searchTerm])

  const { subtotal, costOfGoodsSold, totalAfterDiscount, feeAmount, finalTotal } = useMemo(() => {
    const subtotal = selectedItems.reduce((acc, item) => acc + item.salePrice * item.quantity, 0)
    const costOfGoodsSold = selectedItems.reduce((acc, item) => acc + item.costPrice * item.quantity, 0)
    const totalAfterDiscount = subtotal * (1 - (discountPercentage / 100))
    let feeAmount = 0
    if (paymentMethod === 'Cartão de Crédito' && creditCardFee > 0) feeAmount = totalAfterDiscount * (creditCardFee / 100)
    const finalTotal = totalAfterDiscount + feeAmount
    return { subtotal, costOfGoodsSold, totalAfterDiscount, feeAmount, finalTotal }
  }, [selectedItems, discountPercentage, creditCardFee, paymentMethod])

  const totalDiscount = subtotal - totalAfterDiscount

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    return (sales || []).filter(sale => {
      if (!q) return true
      if ((sale.id || '').toLowerCase().includes(q)) return true
      if ((sale.customerName || '').toLowerCase().includes(q)) return true
      if (sale.items && sale.items.some(it => ((it.productName || '').toLowerCase().includes(q) || (it.sku || '').toLowerCase().includes(q)))) return true
      return false
    })
  }, [sales, historySearch])

  const addItemToSale = (variant) => {
    const existingItem = selectedItems.find(item => item.sku === variant.sku)
    if (existingItem) {
      if (existingItem.quantity < variant.quantity) setSelectedItems(prev => prev.map(item => item.sku === variant.sku ? { ...item, quantity: item.quantity + 1 } : item))
      else showToast('Estoque insuficiente.', 'error')
    } else {
      setSelectedItems(prev => [...prev, { productId: variant.productId, productName: variant.productName, sku: variant.sku, size: variant.size, color: variant.color, quantity: 1, salePrice: variant.salePrice, costPrice: variant.costPrice, stockQuantity: variant.quantity }])
    }
    setSearchTerm('')
  }

  const updateItemQuantity = (sku, newQuantity) => setSelectedItems(prev => prev.map(item => item.sku === sku ? { ...item, quantity: Math.min(Math.max(1, newQuantity), item.stockQuantity) } : item))
  const removeItemFromSale = (sku) => setSelectedItems(prev => prev.filter(item => item.sku !== sku))

  const processSale = async () => {
    if (selectedItems.length === 0) return showToast('O carrinho está vazio.', 'error')
    if (paymentStatus === 'a_receber' && !customerName.trim()) return showToast('Digite um nome de cliente para vendas a receber.', 'error')
    if (paymentStatus === 'a_receber' && !dueDate) return showToast('Preencha a data de vencimento.', 'error')

    setIsProcessing(true)
    try {
      console.log('processSale start', { selectedItems, subtotal, finalTotal, paymentStatus })
      showToast('Iniciando processamento da venda...', 'info')
      // Require Firestore: no demo fallback
      if (!db || !userId) {
        showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
        setIsProcessing(false)
        return
      } else {
        // Firestore flow: create sale doc, decrement product variant stock (batch) and record stockMovements
        try {
          const salesRef = collection(db, getUserCollectionPath(userId, 'sales'))
          const saleData = {
            items: selectedItems,
            subtotal,
            discountPercentage,
            totalDiscount,
            feeAmount,
            finalTotal,
            paymentMethod,
            paymentStatus,
            dueDate: paymentStatus === 'a_receber' && dueDate ? Timestamp.fromDate(new Date(dueDate)) : null,
            customerName,
            customerWhatsapp,
            saleNotes,
            installments,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          }
          const saleRef = await addDoc(salesRef, saleData)

          // prepare batch updates for products and stockMovements
          const batch = writeBatch(db)
          const updatesByProduct = {}
          selectedItems.forEach(it => {
            if (!updatesByProduct[it.productId]) updatesByProduct[it.productId] = []
            updatesByProduct[it.productId].push({ sku: it.sku, qty: it.quantity })
          })

          for (const pid of Object.keys(updatesByProduct)) {
            const productRef = doc(db, getUserCollectionPath(userId, 'products'), pid)
            const prodSnap = await getDoc(productRef)
            if (!prodSnap.exists()) continue
            const parent = prodSnap.data()
            const updatedVariants = (parent.variants || []).map(v => {
              const sold = updatesByProduct[pid].find(s => s.sku === v.sku)
              if (sold) {
                const oldQ = parseInt(v.quantity || 0, 10)
                return { ...v, quantity: Math.max(0, oldQ - sold.qty) }
              }
              return v
            })
            batch.update(productRef, { variants: updatedVariants, updatedAt: Timestamp.now() })

            // add movement logs for each sold variant
            updatesByProduct[pid].forEach(sold => {
              const origVariant = (parent.variants || []).find(v => v.sku === sold.sku)
              const oldQ = origVariant ? parseInt(origVariant.quantity || 0, 10) : 0
              const newQ = Math.max(0, oldQ - sold.qty)
              const movementLogRef = doc(collection(db, getUserCollectionPath(userId, 'stockMovements')))
              batch.set(movementLogRef, { date: Timestamp.now(), productId: pid, productName: parent.name, variantSku: sold.sku, type: 'venda', quantityChange: sold.qty, oldQuantity: oldQ, newQuantity: newQ })
            })
          }

          // commit batch
          await batch.commit()
          showToast(`Venda registrada: ${formatCurrency(finalTotal)}`, 'success')
          // reset form
          setSelectedItems([]); setDiscountPercentage(0); setPaymentMethod('Cartão de Crédito'); setPaymentStatus('recebido'); setDueDate(''); setCustomerName(''); setSaleNotes(''); setCreditCardFee(0); setInstallments(1); setCustomerWhatsapp('')
        } catch (err) {
          console.error('Erro ao processar venda com Firebase:', err)
          showToast('Erro ao processar a venda (Firebase).', 'error')
        }
      }
    } catch (error) {
      console.error('Erro ao processar a venda:', error)
      showToast('Erro ao processar a venda.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Vendas</h2>
        <div className="flex rounded-lg shadow-sm border border-gray-300 dark:border-gray-600 mt-4 md:mt-0">
          <button onClick={() => setView('new')} className={`px-4 py-2 font-semibold rounded-l-lg transition ${view === 'new' ? 'bg-pink-500 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50'}`}>Nova Venda</button>
          <button onClick={() => setView('history')} className={`px-4 py-2 font-semibold rounded-r-lg transition ${view === 'history' ? 'bg-pink-500 text-white' : 'bg-white dark:bg-gray-700 hover:bg-gray-50'}`}>Histórico de Vendas</button>
        </div>
      </div>

      {view === 'new' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <h3 className="text-xl font-bold">1. Adicionar Produtos</h3>
            <input type="text" placeholder="Buscar produto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={inputStyle} />
            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow max-h-[500px] overflow-y-auto">
              {(availableVariants || []).map(v => (
                <div key={v.sku} className="flex justify-between items-center p-3 border rounded-xl mb-2">
                  <div>
                    <p className="font-medium">{v.productName} ({v.size} - {v.color})</p>
                    <p className="text-sm text-gray-500">Qtd: {v.quantity} | {formatCurrency(v.salePrice)}</p>
                  </div>
                  <button onClick={() => addItemToSale(v)} className="p-2 bg-teal-500 text-white rounded-full">+</button>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xl font-bold">2. Finalizar Venda</h3>
            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
              <h3 className="font-semibold text-xl mb-4">Resumo da Venda</h3>
              {selectedItems.length === 0 ? <p className="text-gray-500 text-center py-8">O carrinho está vazio.</p> : (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 mb-4 border-b pb-4">
                  {selectedItems.map(item => (
                    <div key={item.sku} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-medium">{item.productName} ({item.size} - {item.color})</p>
                        <p className="text-sm text-gray-500">{formatCurrency(item.salePrice)} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="number" min="1" max={item.stockQuantity} value={item.quantity} onChange={(e) => updateItemQuantity(item.sku, parseInt(e.target.value, 10))} className="w-16 p-1 text-center border rounded-lg text-sm" />
                        <button onClick={() => removeItemFromSale(item.sku)} className="text-red-500">Remover</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Nome da Cliente</label>
                  <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputStyle} placeholder="Para venda anônima, deixe em branco" />
                </div>
                <div>
                  <label className="block text-sm font-medium">Contato WhatsApp (Opcional)</label>
                  <input type="tel" value={customerWhatsapp} onChange={(e) => setCustomerWhatsapp(e.target.value)} className={inputStyle} placeholder="Será salvo no cadastro" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium">Pagamento:</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputStyle}><option>Cartão de Crédito</option><option>PIX</option><option>Dinheiro</option><option>Débito</option><option>Outro</option></select>
                </div>
                <div>
                  <label className="block text-sm font-medium">Desconto (%):</label>
                  <input type="number" min="0" max="100" value={discountPercentage} onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)} className={inputStyle} />
                </div>
              </div>

              {paymentMethod === 'Cartão de Crédito' && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium">Juros da Maquininha (%):</label>
                    <input type="number" min="0" value={creditCardFee} onChange={(e) => setCreditCardFee(parseFloat(e.target.value) || 0)} className={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">Nº de Parcelas:</label>
                    <input type="number" min="1" value={installments} onChange={(e) => setInstallments(parseInt(e.target.value, 10) || 1)} className={inputStyle} />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium">Status:</label>
                  <div className="flex rounded-lg shadow-sm mt-2">
                    <button type="button" onClick={() => setPaymentStatus('recebido')} className={`w-full py-2 text-sm font-semibold rounded-l-lg transition ${paymentStatus === 'recebido' ? 'bg-teal-500 text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                      ✅ Recebido
                    </button>
                    <button type="button" onClick={() => setPaymentStatus('a_receber')} className={`w-full py-2 text-sm font-semibold rounded-r-lg transition ${paymentStatus === 'a_receber' ? 'bg-yellow-500 text-white' : 'bg-gray-200 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}>
                      ⌛ A Receber
                    </button>
                  </div>
                </div>

                {paymentStatus === 'a_receber' && (
                  <div>
                    <label className="block text-sm font-medium mt-2">Vencimento:</label>
                    <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputStyle} min={new Date().toISOString().split('T')[0]} />
                  </div>
                )}

                <div>
                  <label htmlFor="saleNotes" className="block text-sm font-medium mt-2">Observações:</label>
                  <textarea id="saleNotes" value={saleNotes} onChange={(e) => setSaleNotes(e.target.value)} className={inputStyle} rows="2" placeholder="Detalhes da venda (ex: embrulhar para presente)..."></textarea>
                </div>
              </div>

              <div className="mt-4 border-t pt-4">
                <div className="flex justify-between text-base text-gray-500"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-base text-red-500 font-medium"><span>Desconto:</span><span>- {formatCurrency(totalDiscount)}</span></div>
                {feeAmount > 0 && <div className="flex justify-between text-base text-yellow-600 font-medium"><span>Juros Cartão:</span><span>+ {formatCurrency(feeAmount)}</span></div>}
                <div className="flex justify-between text-2xl font-bold text-gray-800 pt-2 border-t"><span>Total:</span><span className="text-pink-600">{formatCurrency(finalTotal)}</span></div>
                <button onClick={processSale} disabled={selectedItems.length === 0 || isProcessing || finalTotal <= 0} className="mt-4 w-full py-3 text-white font-bold rounded-full bg-pink-500">{isProcessing ? 'Processando...' : 'Finalizar Venda'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div className="space-y-4">
          <input type="text" placeholder="Buscar por ID da Venda, Cliente ou Produto..." value={historySearch} onChange={e => setHistorySearch(e.target.value)} className={inputStyle} />
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
            {filteredHistory.map(sale => (
              <div key={sale.id} className={`${cardStyle} border-l-4 ${sale.paymentStatus === 'estornada' ? 'border-gray-400' : 'border-teal-500'}`}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center">
                  <div>
                    <p className="text-sm text-gray-500">ID: {sale.id.substring(0,8)}... | Data: {new Date(sale.createdAt).toLocaleString('pt-BR')}</p>
                    <p className="font-semibold text-lg">{sale.customerName || 'Venda Anônima'} <span className="text-sm text-gray-500">- {sale.paymentMethod}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-pink-600">{formatCurrency(sale.finalTotal)}</p>
                    <p className="text-sm text-gray-500">{sale.items.length} item(s)</p>
                  </div>
                </div>
                <div className="mt-3">
                  {sale.items.map(it => (
                    <div key={it.sku} className="flex justify-between text-sm border-b py-1">
                      <div>{it.productName} ({it.size} - {it.color})</div>
                      <div>{it.quantity} x {formatCurrency(it.salePrice)}</div>
                    </div>
                  ))}
                  {sale.saleNotes && <p className="mt-2"><strong>Observações:</strong> {sale.saleNotes}</p>}
                </div>
              </div>
            ))}
            {filteredHistory.length === 0 && <p className="text-center text-gray-500">Nenhuma venda encontrada.</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesManagement
