import React, { useState, useEffect, useMemo } from 'react'
import CustomModal from '../ui/CustomModal'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore'
import { getUserCollectionPath } from '../../utils/paths'
import { Timestamp } from 'firebase/firestore'

const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 transition duration-150 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'

const CustomersManagement = ({ db, userId, customers = [], sales = [], showToast = () => {} }) => {
  const [view, setView] = useState('list')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const defaultForm = { name: '', phone: '', email: '', birthday: '', preferences: '', tags: '' }
  const [formData, setFormData] = useState(defaultForm)

  useEffect(() => {
    if (editingCustomer) {
      setFormData({ name: editingCustomer.name || '', phone: editingCustomer.phone || '', email: editingCustomer.email || '', birthday: editingCustomer.birthday || '', preferences: editingCustomer.preferences || '', tags: (editingCustomer.tags || []).join(', ') })
    } else {
      setFormData(defaultForm)
    }
  }, [editingCustomer])

  const openModal = (customer = null) => { setEditingCustomer(customer); setIsModalOpen(true) }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) return showToast('O nome da cliente é obrigatório.', 'error')

    if (!db || !userId) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      return
    }

    try {
      const colRef = collection(db, getUserCollectionPath(userId, 'customers'))
      const payload = { ...formData, tags: formData.tags ? formData.tags.split(',').map(t=>t.trim()).filter(Boolean) : [], updatedAt: Timestamp.now() }
      if (editingCustomer) {
        await updateDoc(doc(colRef, editingCustomer.id), payload)
        showToast('Cliente atualizada!', 'success')
      } else {
        await addDoc(colRef, { ...payload, createdAt: Timestamp.now() })
        showToast('Nova cliente adicionada!', 'success')
      }
      setIsModalOpen(false); setEditingCustomer(null)
    } catch (error) {
      console.error('Erro ao salvar cliente:', error)
      showToast('Erro ao salvar cliente.', 'error')
    }
  }

  const confirmDelete = (customer) => { setCustomerToDelete(customer); setIsDeleteModalOpen(true) }
  const handleDelete = async () => {
    if (!customerToDelete) return
    if (!db || !userId) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error')
      setIsDeleteModalOpen(false); setCustomerToDelete(null)
      if (view === 'profile' && selectedCustomer?.id === customerToDelete.id) { setView('list'); setSelectedCustomer(null) }
      return
    }
    try {
      const colRef = collection(db, getUserCollectionPath(userId, 'customers'))
      await deleteDoc(doc(colRef, customerToDelete.id))
      showToast('Cliente excluída!', 'success')
    } catch (error) {
      console.error('Erro ao deletar cliente:', error)
      showToast('Erro ao excluir cliente.', 'error')
    } finally {
      setIsDeleteModalOpen(false); setCustomerToDelete(null)
      if (view === 'profile' && selectedCustomer?.id === customerToDelete.id) { setView('list'); setSelectedCustomer(null) }
    }
  }

  const filteredCustomers = useMemo(() => (customers || []).filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || (c.phone && c.phone.includes(searchTerm)) || (c.tags && c.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase())))), [customers, searchTerm])

  const ProfileView = ({ customer }) => {
    const [notes, setNotes] = useState([])
    const [newNote, setNewNote] = useState('')
    const [expandedSale, setExpandedSale] = useState(null)

    const customerSales = useMemo(() => (sales || []).filter(s => s.customerId === customer.id).sort((a,b)=>b.date?.seconds - a.date?.seconds), [sales, customer.id])
    const customerStats = useMemo(() => { const totalSpent = customerSales.reduce((sum,s)=>sum + s.totalAmount, 0); const lastPurchase = customerSales.length>0 ? customerSales[0].date?.toDate() : null; return { totalSpent, lastPurchase } }, [customerSales])

    useEffect(() => {
      // Load notes from Firestore (subcollection customers/{id}/notes)
      const loadNotes = async () => {
        if (!db || !userId) { setNotes([]); return }
        try {
          const notesCol = collection(doc(db, getUserCollectionPath(userId, 'customers'), customer.id), 'notes')
          const snap = await getDocs(notesCol)
          const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          setNotes(arr.sort((a,b)=> (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
        } catch (err) { console.error('Erro ao carregar notas:', err); setNotes([]) }
      }
      loadNotes()
    }, [customer.id, db, userId])

    const handleAddNote = async () => {
      if (!newNote.trim()) return
      if (!db || !userId) { showToast('Firestore não configurado. Faça login com uma conta válida.', 'error'); return }
      try {
        const notesCol = collection(doc(db, getUserCollectionPath(userId, 'customers'), customer.id), 'notes')
        await addDoc(notesCol, { text: newNote.trim(), createdAt: Timestamp.now() })
        setNewNote('')
        // reload notes
        const snap = await getDocs(notesCol)
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setNotes(arr.sort((a,b)=> (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
        showToast('Anotação adicionada!', 'success')
      } catch (err) { console.error('Erro ao adicionar nota:', err); showToast('Erro ao adicionar nota.', 'error') }
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <button onClick={() => setView('list')} className="text-sm text-pink-600 hover:underline">‹ Voltar para a Lista</button>
            <h2 className="text-3xl font-bold">{customer.name}</h2>
          </div>
          <div className="space-x-2">
            <button onClick={() => openModal(customer)} className="px-4 py-2 text-sm text-white font-semibold rounded-full bg-indigo-500">Editar</button>
            <button onClick={() => confirmDelete(customer)} className="px-4 py-2 text-sm text-white font-semibold rounded-full bg-red-500">Excluir</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded shadow lg:col-span-1">
            <h3 className="text-xl font-semibold">Informações</h3>
            <p><strong>Telefone:</strong> {customer.phone || 'N/A'}</p>
            <p><strong>Email:</strong> {customer.email || 'N/A'}</p>
            <p><strong>Aniversário:</strong> {customer.birthday || 'N/A'}</p>
            <div>
              <h4 className="font-semibold">Tags:</h4>
              <div className="flex flex-wrap gap-2 mt-2">{(customer.tags||[]).map(tag => <span key={tag} className="px-2 py-1 text-xs font-semibold text-pink-800 bg-pink-100 rounded-full">{tag}</span>)}</div>
            </div>
          </div>
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
              <h3 className="text-xl font-semibold">Anotações</h3>
              <div className="flex space-x-2 mb-4">
                <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} rows="2" className={inputStyle} placeholder="Adicionar nova anotação..."></textarea>
                <button onClick={handleAddNote} className="px-4 text-white font-semibold rounded-lg bg-pink-500">Salvar</button>
              </div>
              <div className="space-y-3 max-h-40 overflow-y-auto">{notes.map(n => (<div key={n.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded"><p className="text-sm">{n.text}</p><p className="text-xs text-right text-gray-400">{new Date(n.createdAt.seconds*1000).toLocaleString('pt-BR')}</p></div>))}</div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
              <h3 className="text-xl font-semibold">Histórico de Compras ({customerSales.length})</h3>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {customerSales.length>0 ? customerSales.map(sale => (
                  <div key={sale.id} className="p-4 rounded-lg border-l-4 bg-white dark:bg-gray-700/50 border-teal-500">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-500">{sale.date?.toDate ? sale.date.toDate().toLocaleString('pt-BR') : sale.date}</p>
                        <p className="font-bold text-lg">{formatCurrency(sale.totalAmount)} - <span className="font-medium">{sale.paymentMethod}</span></p>
                      </div>
                      <div>
                        <button onClick={() => setExpandedSale(expandedSale === sale.id ? null : sale.id)} className="text-sm font-semibold text-gray-600">{expandedSale===sale.id ? 'Fechar' : 'Ver Itens'}</button>
                      </div>
                    </div>
                    {expandedSale===sale.id && (<div className="mt-4 pt-4 border-t text-sm"><p className="font-semibold">Itens Comprados:</p><ul className="list-disc list-inside">{sale.items.map(item=> <li key={item.sku}>{item.quantity}x {item.name} - R$ {item.salePrice}</li>)}</ul></div>)}
                  </div>
                )) : <p className="text-gray-500">Nenhuma compra registrada para esta cliente.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'profile' && selectedCustomer) return <ProfileView customer={selectedCustomer} />

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center">
        <h2 className="text-2xl font-bold">Gestão de Clientes</h2>
        <div className="flex items-center space-x-2 mt-4 md:mt-0">
          <input type="text" placeholder="Buscar por nome, telefone, tag..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className={inputStyle + ' max-w-sm'} />
          <button onClick={() => openModal()} className="px-4 py-3 text-white font-semibold rounded-lg bg-pink-500">+ Nova Cliente</button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCustomers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium">{c.name}</div>
                  {c.email && <div className="text-sm text-gray-500">{c.email}</div>}
                </td>
                <td className="px-6 py-4"><div className="text-sm">{c.phone || 'N/A'}</div></td>
                <td className="px-6 py-4"><div className="flex flex-wrap gap-1">{(c.tags||[]).slice(0,3).map(tag => <span key={tag} className="px-2 py-1 text-xs font-semibold text-pink-800 bg-pink-100 rounded-full">{tag}</span>)}</div></td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  <button onClick={() => openModal(c)} className="text-indigo-600 mr-4">Editar</button>
                  <button onClick={() => { setSelectedCustomer(c); setView('profile') }} className="text-indigo-600">Ver Perfil</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CustomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCustomer ? 'Editar Cliente' : 'Adicionar Cliente'}
  actions={<><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-full">Cancelar</button><button onClick={handleSave} className="px-4 py-2 text-white rounded-full bg-pink-500">{editingCustomer ? 'Salvar' : 'Adicionar'}</button></>}>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label>Nome*</label><input type="text" name="name" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} className={inputStyle} /></div>
            <div><label>Telefone</label><input type="tel" name="phone" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})} className={inputStyle} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label>Email</label><input type="email" name="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className={inputStyle} /></div>
            <div><label>Aniversário</label><input type="date" name="birthday" value={formData.birthday} onChange={e=>setFormData({...formData, birthday: e.target.value})} className={inputStyle} /></div>
          </div>
          <div><label>Preferências</label><textarea name="preferences" rows="3" value={formData.preferences} onChange={e=>setFormData({...formData, preferences: e.target.value})} className={inputStyle}></textarea></div>
          <div><label>Tags (separadas por vírgula)</label><input type="text" name="tags" value={formData.tags} onChange={e=>setFormData({...formData, tags: e.target.value})} className={inputStyle} /></div>
        </form>
      </CustomModal>

      <CustomModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" size="max-w-md"
  actions={<><button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-full">Cancelar</button><button onClick={handleDelete} className="px-4 py-2 text-white rounded-full bg-red-500">Excluir</button></>}>
        <p>Tem certeza que deseja excluir a cliente <strong>{customerToDelete?.name}</strong>?</p>
      </CustomModal>
    </div>
  )
}

// small helper used in profile view; import formatCurrency if you have a central util
const formatCurrency = (v=0) => {
  try { return (Number(v)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) } catch { return `R$ ${v}` }
}

export default CustomersManagement
