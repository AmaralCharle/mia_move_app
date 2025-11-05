import React, { useState, useEffect } from 'react'
import CustomModal from '../ui/CustomModal'
import { collection, addDoc, updateDoc, deleteDoc, doc, query, getDocs, where, Timestamp } from 'firebase/firestore'
import { getUserCollectionPath } from '../../utils/paths'
import { formatCurrency, getStartOfDay } from '../../utils/format'
import { toJSDate } from '../../utils/dates'

const primaryColor = 'bg-pink-500 hover:bg-pink-600'
const dangerColor = 'bg-red-500 hover:bg-red-600'
const inputStyle = 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 transition duration-150 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-50'
const cardStyle = 'bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-lg dark:border dark:border-gray-700'

const ExpenseCategoryChart = ({ expenses }) => {
  const categoryData = React.useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const expensesInMonth = (expenses || []).filter(e => { const d = toJSDate(e.date); return d ? d >= startOfMonth : false });

    const data = expensesInMonth.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {});

    const total = Object.values(data).reduce((sum, v) => sum + v, 0);
    return Object.entries(data).map(([category, amount]) => ({ category, amount, percentage: total > 0 ? ((amount / total) * 100) : 0 })).sort((a,b)=>b.amount - a.amount);
  }, [expenses]);

  if (!categoryData || categoryData.length === 0) return null;

  const colors = ['bg-pink-500','bg-teal-500','bg-yellow-500','bg-purple-500','bg-orange-500','bg-indigo-500'];
  return (
    <div className={cardStyle}>
      <h3 className="text-xl font-semibold mb-4">Despesas do Mês por Categoria</h3>
      <div className="space-y-4">
        <div className="flex h-6 rounded-full overflow-hidden shadow-inner">
          {categoryData.map((item, index) => (<div key={item.category} style={{ width: `${item.percentage}%` }} className={colors[index % colors.length]} title={`${item.category}: ${item.percentage.toFixed(1)}%`} />))}
        </div>
        <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          {categoryData.map((item, index) => (
            <li key={item.category} className="flex items-center space-x-2">
              <span className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}></span>
              <span className="text-gray-700 dark:text-gray-300">{item.category}:</span>
              <span className="font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(item.amount)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const RecurringExpensesManagement = ({ isOpen, onClose, db, userId, showToast, recurringExpenses = [], onLaunch, expenseCategories = [] }) => {
  const [formData, setFormData] = useState({ description: '', amount: '', category: expenseCategories[0] || 'Matéria Prima' });

  useEffect(() => {
    setFormData({ description: '', amount: '', category: expenseCategories[0] || 'Matéria Prima' });
  }, [isOpen, expenseCategories]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleAdd = async () => {
    if (!formData.description.trim() || parseFloat(formData.amount) <= 0) { showToast('Descrição e valor são obrigatórios', 'error'); return; }
    if (!db || !userId) {
      showToast('Firestore não configurado. Faça login com uma conta válida.', 'error');
      return;
    }
    await addDoc(collection(db, getUserCollectionPath(userId, 'recurringExpenses')), { ...formData, amount: parseFloat(formData.amount) });
    setFormData({ description: '', amount: '', category: expenseCategories[0] || 'Matéria Prima' });
    showToast('Despesa recorrente adicionada!', 'success');
  };

  const handleDelete = async (id) => {
    if (!db || !userId) { showToast('Firestore não configurado. Faça login com uma conta válida.', 'error'); return; }
    await deleteDoc(doc(db, getUserCollectionPath(userId, 'recurringExpenses'), id));
    showToast('Despesa recorrente excluída', 'success');
  };

  const handleLaunch = (recurring) => {
    if (onLaunch) onLaunch({ description: recurring.description, amount: recurring.amount, category: recurring.category, status: 'a_pagar', date: new Date().toISOString().split('T')[0], dueDate: new Date().toISOString().split('T')[0] });
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title="Gerenciar Despesas Recorrentes" size="max-w-2xl">
      <div className="space-y-4">
        <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-3">
          <h4 className="font-semibold">Adicionar Nova Despesa Recorrente</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input name="description" value={formData.description} onChange={handleChange} className={inputStyle} placeholder="Descrição (Ex: Aluguel)" />
            <input name="amount" value={formData.amount} onChange={handleChange} className={inputStyle} placeholder="Valor (R$)" />
            <select name="category" value={formData.category} onChange={handleChange} className={inputStyle}>{expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <button onClick={handleAdd} className={`w-full py-2 text-white font-semibold rounded-lg ${primaryColor}`}>Adicionar</button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(recurringExpenses || []).map(item => (
              <li key={item.id} className="py-3 flex justify-between items-center">
                <div>
                  <p className="font-medium dark:text-gray-200">{item.description} - {formatCurrency(item.amount)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{item.category}</p>
                </div>
                <div className="space-x-2">
                  <button onClick={() => handleLaunch(item)} className="px-3 py-1 text-sm text-white bg-blue-500 rounded-full">Lançar no Mês</button>
                  <button onClick={() => handleDelete(item.id)} className="text-red-500">Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CustomModal>
  );
}

const ExpensesManagement = ({ db, userId, expenses = [], showToast = () => {}, recurringExpenses = [], onLaunchRecurring = null }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

  const defaultFormData = { description: '', amount: '', category: 'Matéria Prima', date: new Date().toISOString().split('T')[0], status: 'pago', dueDate: '' };
  const [formData, setFormData] = useState(defaultFormData);

  const expenseCategories = ['Matéria Prima', 'Marketing', 'Aluguel', 'Salários', 'Impostos', 'Outros'];

  useEffect(() => {
    if (editingExpense) {
  const expenseDate = (toJSDate(editingExpense.date) && toJSDate(editingExpense.date).toISOString().split('T')[0]) || editingExpense.date || new Date().toISOString().split('T')[0];
  const expenseDueDate = (toJSDate(editingExpense.dueDate) && toJSDate(editingExpense.dueDate).toISOString().split('T')[0]) || editingExpense.dueDate || '';
      setFormData({ ...editingExpense, date: expenseDate, dueDate: expenseDueDate });
    }
  }, [editingExpense]);

  const openNewExpenseModal = (prefillData = null) => {
    setEditingExpense(null);
    setFormData(prefillData ? { ...defaultFormData, ...prefillData } : defaultFormData);
    setIsModalOpen(true);
  };

  useEffect(() => { if (onLaunchRecurring) openNewExpenseModal(onLaunchRecurring); }, [onLaunchRecurring]);

  const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };

  const handleSave = async (e) => {
    e && e.preventDefault();
    if (!formData.description || parseFloat(formData.amount) <= 0) return showToast('Preencha a descrição e um valor válido.', 'error');
  if (!db || !userId) { showToast('Firestore não configurado. Faça login com uma conta válida.', 'error'); setIsModalOpen(false); setEditingExpense(null); return; }
    try {
      const dataToSave = { ...formData, amount: parseFloat(formData.amount), date: Timestamp.fromDate(new Date(formData.date.replace(/-/g, '/'))), dueDate: formData.status === 'a_pagar' && formData.dueDate ? Timestamp.fromDate(new Date(formData.dueDate.replace(/-/g, '/'))) : null };
      const expensesRef = collection(db, getUserCollectionPath(userId, 'expenses'));
      if (editingExpense) { await updateDoc(doc(expensesRef, editingExpense.id), dataToSave); showToast('Despesa atualizada!', 'success'); } else { await addDoc(expensesRef, dataToSave); showToast('Despesa adicionada!', 'success'); }
      setIsModalOpen(false); setEditingExpense(null);
    } catch (error) { console.error('Erro ao salvar despesa:', error); showToast('Erro ao salvar despesa.', 'error'); }
  };

  const confirmDelete = (expense) => { setExpenseToDelete(expense); setIsDeleteModalOpen(true); };
  const handleDelete = async () => { if (!expenseToDelete) return; if (!db || !userId) { showToast('Firestore não configurado. Faça login com uma conta válida.', 'error'); setIsDeleteModalOpen(false); setExpenseToDelete(null); return; } try { await deleteDoc(doc(db, getUserCollectionPath(userId, 'expenses'), expenseToDelete.id)); showToast('Despesa excluída.', 'success'); } catch (error) { showToast('Erro ao excluir.', 'error'); } finally { setIsDeleteModalOpen(false); setExpenseToDelete(null); } };

  const handleMarkAsPaid = async (expense) => {
  if (!db || !userId) { showToast('Firestore não configurado. Faça login com uma conta válida.', 'error'); return; }
    const expenseRef = doc(db, getUserCollectionPath(userId, 'expenses'), expense.id);
    try { await updateDoc(expenseRef, { status: 'pago' }); showToast('Despesa marcada como paga!', 'success'); } catch (error) { showToast('Erro ao atualizar despesa.', 'error'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Controle de Despesas</h2>
        <div className="flex space-x-2">
          <button onClick={() => setIsRecurringModalOpen(true)} className="px-4 py-2 text-teal-600 font-semibold bg-teal-100 rounded-lg">Gerenciar Recorrentes</button>
          <button onClick={() => openNewExpenseModal()} className={`px-4 py-2 text-white font-semibold rounded-lg ${primaryColor}`}>+ Nova Despesa</button>
        </div>
      </div>
      <ExpenseCategoryChart expenses={expenses} />
      <div className={cardStyle}>
        <h3 className="text-xl font-semibold mb-4">Despesas Registradas ({(expenses || []).length})</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Data</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Descrição</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Categoria</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Valor</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-800 dark:text-gray-200 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(expenses || []).map(exp => {
                const isOverdue = exp.status === 'a_pagar' && toJSDate(exp.dueDate) ? toJSDate(exp.dueDate) < getStartOfDay(new Date()) : false;
                return (
                  <tr key={exp.id} className={isOverdue ? 'bg-red-50' : ''}>
                    <td className="px-3 py-4 text-sm">{(toJSDate(exp.date) && toJSDate(exp.date).toLocaleDateString('pt-BR')) || exp.date}</td>
                    <td className="px-3 py-4 text-sm font-medium">{exp.description}</td>
                    <td className="px-3 py-4 text-sm"><span className="px-2 inline-flex text-xs font-semibold rounded-full bg-pink-100 text-pink-800">{exp.category}</span></td>
                    <td className="px-3 py-4 text-sm font-semibold text-red-600">{formatCurrency(exp.amount)}</td>
                    <td className="px-3 py-4 text-sm">{exp.status === 'pago' ? <span className="text-green-600 font-semibold">Pago</span> : <span className="text-yellow-600 font-semibold">A Pagar {toJSDate(exp.dueDate) ? `em ${toJSDate(exp.dueDate).toLocaleDateString('pt-BR')}` : ''}</span>}</td>
                    <td className="px-3 py-4 text-right text-sm space-x-2">
                      {exp.status === 'a_pagar' && <button onClick={() => handleMarkAsPaid(exp)} className="text-green-600">Pagar</button>}
                      <button onClick={() => { setEditingExpense(exp); setIsModalOpen(true); }} className="text-indigo-600">Editar</button>
                      <button onClick={() => confirmDelete(exp)} className="text-red-600">Deletar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

  <CustomModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingExpense ? 'Editar Despesa' : 'Adicionar Despesa'} actions={<><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-full">Cancelar</button><button onClick={handleSave} className={`px-4 py-2 text-white rounded-full ${primaryColor}`}>{editingExpense ? 'Salvar' : 'Adicionar'}</button></>}>
        <form className="space-y-4">
          <div><label>Nome / Descrição</label><input type="text" name="description" value={formData.description} onChange={handleChange} className={inputStyle} /></div>
          <div className="grid grid-cols-2 gap-4"><div><label>Valor (R$)</label><input type="number" name="amount" value={formData.amount} onChange={handleChange} className={inputStyle} /></div><div><label>Data</label><input type="date" name="date" value={formData.date} onChange={handleChange} className={inputStyle} /></div></div>
          <div><label>Categoria</label><select name="category" value={formData.category} onChange={handleChange} className={inputStyle}>{expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4"><div><label>Status</label><div className="flex">
            <button type="button" onClick={() => setFormData({...formData, status: 'pago'})} className={`w-full py-2 ${formData.status === 'pago' ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>Pago</button>
            <button type="button" onClick={() => setFormData({...formData, status: 'a_pagar'})} className={`w-full py-2 ${formData.status === 'a_pagar' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}`}>A Pagar</button>
          </div></div>{formData.status === 'a_pagar' && (<div><label>Vencimento</label><input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} className={inputStyle} /></div>)}</div>
        </form>
      </CustomModal>

  <CustomModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirmar Exclusão" size="max-w-md" actions={<><button onClick={() => setIsDeleteModalOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 rounded-full">Cancelar</button><button onClick={handleDelete} className={`px-4 py-2 text-white rounded-full ${dangerColor}`}>Excluir</button></>}> 
        <p>Tem certeza que deseja excluir a despesa <strong>{expenseToDelete?.description}</strong>?</p>
      </CustomModal>

      {isRecurringModalOpen && <RecurringExpensesManagement isOpen={isRecurringModalOpen} onClose={() => setIsRecurringModalOpen(false)} db={db} userId={userId} showToast={showToast} recurringExpenses={recurringExpenses} onLaunch={data => { setIsRecurringModalOpen(false); openNewExpenseModal(data); }} expenseCategories={expenseCategories} />}
    </div>
  )
}

export default ExpensesManagement
