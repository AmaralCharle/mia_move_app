import React, { useState, useLayoutEffect, useCallback, useEffect } from 'react'
import { db, firebaseConfig, auth } from './firebase/firebaseClient'
import { onAuthStateChanged, signOut as firebaseSignOut, setPersistence, browserSessionPersistence } from 'firebase/auth'
import { collection, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore'
import { getUserCollectionPath } from './utils/paths'
import SyncModal from './components/sync/SyncModal'
import Toast from './components/ui/Toast'
import LoadingSpinner from './components/ui/LoadingSpinner'
import LoginPage from './components/auth/LoginPage'
import StockManagement from './components/stock/StockManagement'
import SalesManagement from './components/sales/SalesManagement'
import CustomersManagement from './components/customers/CustomersManagement'
import ExpensesManagement from './components/expenses/ExpensesManagement'
import GoalsManagement from './components/goals/GoalsManagement'
import ReportsManagement from './components/reports/ReportsManagement'
import DefectsManagement from './components/defects/DefectsManagement'
import AIAdvisor from './components/ai/AIAdvisor'
import Dashboard from './components/dashboard/Dashboard'

const App = () => {
  const getInitialTheme = () => {
    try {
      const stored = localStorage.getItem('mia-move-theme')
      if (stored === 'light' || stored === 'dark') return stored
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
    } catch (e) {}
    return 'light'
  }

  const [theme, setTheme] = useState(getInitialTheme)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [activeTab, setActiveTab] = useState('Início')
  // Demo/localStorage state removed — application requires Firestore and authenticated master user

  // Apply theme synchronously to avoid a flash and persist preference
  useLayoutEffect(() => {
    const root = window.document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    try { localStorage.setItem('mia-move-theme', theme) } catch (e) {}
  }, [theme])

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleLogin = (user) => {
    try { localStorage.setItem('mia-user', JSON.stringify(user)) } catch (e) {}
    setIsAuthenticated(true)
    setCurrentUser(user)
    showToast('Bem-vindo ' + (user.email || ''), 'success')
  }

  const handleLogout = () => {
    try { localStorage.removeItem('mia-user') } catch (e) {}
    setIsAuthenticated(false)
    setCurrentUser(null)
    showToast('Sessão encerrada', 'info')
    // sign out from firebase if available
    try { if (auth) firebaseSignOut(auth) } catch (e) {}
  }

  // Keep app state in browser history so Back/Forward work and allow deep-linking via hash
  const skipPushRef = React.useRef(false)

  React.useEffect(() => {
    // on mount, if there's a hash or history state, use it
    try {
      const fromHash = window.location.hash && decodeURIComponent(window.location.hash.slice(1));
      const fromState = window.history.state && window.history.state.tab;
      if (fromHash) setActiveTab(fromHash);
      else if (fromState) setActiveTab(fromState);
      else {
        // push initial state
        window.history.replaceState({ tab: activeTab }, '')
      }
    } catch (e) {}

    const onPop = (e) => {
      try {
        const tab = (e.state && e.state.tab) || (window.location.hash ? decodeURIComponent(window.location.hash.slice(1)) : 'Início')
        // prevent the following activeTab effect from pushing a new history entry
        skipPushRef.current = true
        setActiveTab(tab)
      } catch (err) {}
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  React.useEffect(() => {
    try {
      // push state to history so Back/Forward works
      if (skipPushRef.current) {
        // this change was triggered by popstate (back/forward) - don't push a new entry
        skipPushRef.current = false
      } else {
        window.history.pushState({ tab: activeTab }, '', `#${encodeURIComponent(activeTab)}`)
      }
    } catch (e) {}
  }, [activeTab])

  // If firebaseConfig is not present we allow running in a fallback/demo mode
  const hasDb = !!firebaseConfig && !!db
  // userId is taken from the authenticated Firebase user
  const userId = currentUser ? currentUser.uid : null

  // If Firestore is not configured, stop early and instruct configuration
  if (!hasDb) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-xl p-8 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-2">Firebase não configurado</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">Esta versão da aplicação requer conexão com Firestore. Por favor verifique o `firebaseConfig` e assegure que o Firestore esteja habilitado no projeto.</p>
        </div>
      </div>
    )
  }

  // Listen to Firebase auth state when DB is available
  useEffect(() => {
    if (!hasDb || !auth) return
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setIsAuthenticated(true)
        setCurrentUser({ uid: user.uid, email: user.email, displayName: user.displayName })
      } else {
        setIsAuthenticated(false)
        setCurrentUser(null)
      }
    })
    return () => unsub()
  }, [hasDb])

  // Make auth use session persistence (so closing the tab ends the session)
  useEffect(() => {
    if (!hasDb || !auth) return
    try {
      setPersistence(auth, browserSessionPersistence).catch(e => { console.warn('setPersistence failed', e) })
    } catch (e) {}

    // NOTE: do NOT sign out on beforeunload — using browserSessionPersistence
    // will keep the session across reloads and clear it when the tab is closed.
    return () => {}
  }, [hasDb])

  // realtime listeners for Firestore collections for the authenticated user
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState([])
  const [defectiveItems, setDefectiveItems] = useState([])
  const [expenses, setExpenses] = useState([])
  const [customers, setCustomers] = useState([])
  const [categories, setCategories] = useState([])
  const [goals, setGoals] = useState([])

  useEffect(() => {
    if (!hasDb || !currentUser) return
    const uid = currentUser.uid
    const unsubscribes = []

    const listen = (colName, setter, withOrder = true) => {
      try {
        const colRef = collection(db, getUserCollectionPath(uid, colName))
        const q = withOrder ? query(colRef, orderBy('createdAt', 'desc')) : query(colRef)
        const unsub = onSnapshot(q, (snap) => {
          const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          setter(arr)
        }, (err) => {
          console.error('Firestore listen error', colName, err)
          showToast('Erro ao escutar ' + colName, 'error')
        })
        unsubscribes.push(unsub)
      } catch (e) { console.error('listen setup error', e) }
    }

    listen('products', setProducts)

    // In some edge cases the realtime onSnapshot may delay; listen for a manual refresh event
    let refreshTimeout = null
    const handleProductsRefresh = async (e) => {
      try {
        const colRef = collection(db, getUserCollectionPath(uid, 'products'))
        const snaps = await getDocs(colRef)
        const arr = snaps.docs.map(d => ({ id: d.id, ...d.data() }))
        setProducts(arr)
      } catch (err) {
        console.error('products refresh failed', err)
      }
      // schedule a retry fetch after a short delay to handle eventual consistency / snapshot latency
      try {
        if (refreshTimeout) clearTimeout(refreshTimeout)
      } catch (e) {}
      refreshTimeout = setTimeout(async () => {
        try {
          const colRef2 = collection(db, getUserCollectionPath(uid, 'products'))
          const snaps2 = await getDocs(colRef2)
          const arr2 = snaps2.docs.map(d => ({ id: d.id, ...d.data() }))
          setProducts(arr2)
        } catch (err) { console.error('products retry refresh failed', err) }
      }, 1500)
    }
    window.addEventListener('mia:products-updated', handleProductsRefresh)
    listen('sales', setSales)
    listen('defectiveItems', setDefectiveItems)
    listen('expenses', setExpenses)
    listen('customers', setCustomers)
    listen('categories', setCategories)
    listen('goals', setGoals, false)

  return () => { unsubscribes.forEach(u => u()); window.removeEventListener('mia:products-updated', handleProductsRefresh); try { if (refreshTimeout) clearTimeout(refreshTimeout) } catch(e) {} }
  }, [hasDb, currentUser])

  // demo event listeners removed

  if (!true) return <LoadingSpinner />

  // if not authenticated, show login page
  if (!isAuthenticated) return <LoginPage onLogin={handleLogin} />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-200">
      <header className="bg-white dark:bg-gray-800 shadow-md">
        <div className="p-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 onClick={() => setActiveTab('Início')} className="text-3xl cursor-pointer font-extrabold text-pink-600 tracking-wider">Mia Move <span className="text-teal-500 text-sm font-medium">Gestão</span></h1>
            {/* small nav or tagline could go here */}
          </div>
          <div className="flex items-center space-x-3 sm:space-x-4">
            {/* botão Sincronizar removido conforme solicitado */}

            <button onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))} title="Alternar tema" className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">
              {/* sun / moon icon */}
              {theme === 'dark' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 116.707 2.707 8 8 0 0017.293 13.293z" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 2.03a1 1 0 011.4 1.42l-.7.7a1 1 0 11-1.4-1.42l.7-.7zM18 9a1 1 0 110 2h-1a1 1 0 110-2h1zM5.46 4.05a1 1 0 011.4 1.42l-.7.7A1 1 0 114.76 5.77l.7-.72zM4 9a1 1 0 100 2H3a1 1 0 100-2h1zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM3.05 14.54a1 1 0 011.42 1.4l-.7.7a1 1 0 11-1.42-1.4l.7-.7zM16.95 14.54a1 1 0 011.42 1.4l-.7.7a1 1 0 11-1.42-1.4l.7-.7z" /></svg>
              )}
            </button>

            <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">PR</span>
            </div>
            <button onClick={handleLogout} title="Sair" className="ml-2 px-3 py-1 text-sm rounded bg-gray-100 dark:bg-gray-700">Sair</button>
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-6 lg:p-8">
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6 sticky top-0 bg-gray-50 dark:bg-gray-900 z-20">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            {['Início','Estoque','Vendas','Clientes','Despesas','Metas','Relatórios','Defeitos','Consultor - IA'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-base sm:text-lg transition ${activeTab === tab ? 'border-pink-500 text-pink-600 dark:border-pink-400 dark:text-pink-400' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'}`}>{tab}</button>
            ))}
          </nav>
        </div>

        {activeTab === 'Início' ? (
    <Dashboard sales={sales} expenses={expenses} products={products} monthlyGoal={null} setActiveTab={setActiveTab} />
        ) : activeTab === 'Estoque' ? (
          <StockManagement db={db} userId={userId} products={products} showToast={showToast} categories={categories} />
        ) : activeTab === 'Vendas' ? (
          <SalesManagement db={db} userId={userId} products={products} sales={sales} customers={customers} showToast={showToast} />
        ) : activeTab === 'Clientes' ? (
          <CustomersManagement db={db} userId={userId} customers={customers} sales={sales} showToast={showToast} />
        ) : activeTab === 'Despesas' ? (
          <ExpensesManagement db={db} userId={userId} showToast={showToast} />
        ) : activeTab === 'Metas' ? (
          <GoalsManagement db={db} userId={userId} sales={sales} expenses={expenses} allGoals={goals} showToast={showToast} />
        ) : activeTab === 'Relatórios' ? (
          <ReportsManagement db={db} userId={userId} sales={sales} products={products} expenses={expenses} showToast={showToast} />
        ) : activeTab === 'Defeitos' ? (
          <DefectsManagement db={db} userId={userId} products={products} defectiveItems={defectiveItems} showToast={showToast} />
        ) : activeTab === 'Consultor - IA' ? (
          <AIAdvisor db={db} userId={userId} showToast={showToast} />
        ) : (
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">Página: {activeTab} (ainda em desenvolvimento)</div>
        )}
      </main>

      {isSyncModalOpen && (
        <SyncModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          showToast={showToast}
          onSync={(uid) => { showToast('Sincronizado com ' + uid, 'success') }}
          onUnsync={() => { showToast('Sincronização desfeita', 'info') }}
          currentUid={userId}
          isSynced={false}
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

export default App
