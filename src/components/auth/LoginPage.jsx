import React, { useState } from 'react'
import { signInWithEmailAndPassword, signOut, setPersistence, browserSessionPersistence, inMemoryPersistence, browserLocalPersistence } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../firebase/firebaseClient'

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [remember, setRemember] = useState(false)

  const MASTER_EMAIL = 'usemiamove@gmail.com'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) return alert('Preencha email e senha')
    setLoading(true)
    try {
      // set persistence according to "remember" checkbox
      try {
        await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence)
      } catch (pErr) {
        console.warn('setPersistence failed', pErr)
      }
      const res = await signInWithEmailAndPassword(auth, email.trim(), password)
      const user = res.user
      // fetch users/{uid} doc to check role
      const userDocRef = doc(db, 'users', user.uid)
      const snap = await getDoc(userDocRef)
      if (!snap.exists()) {
        // if this login email matches configured master email we can auto-create the profile doc
        if (user.email === MASTER_EMAIL) {
          try {
            await setDoc(userDocRef, { email: user.email, role: 'master', createdAt: serverTimestamp() })
            // refresh snap
          } catch (e) {
            console.error('Failed to create master user doc', e)
            await signOut(auth)
            setLoading(false)
            return alert('Falha ao criar o perfil do usuário. Contate o administrador.')
          }
        } else {
          // sign out and show message
          await signOut(auth)
          setLoading(false)
          return alert('Usuário autenticado, mas documento de perfil não encontrado. Contate o administrador.')
        }
      }
  // refetch to get the data (in case we created it)
  const snap2 = await getDoc(userDocRef)
  const data = snap2.exists() ? snap2.data() : (snap.exists() ? snap.data() : null)
  if (!data || data.role !== 'master') {
        await signOut(auth)
        setLoading(false)
        return alert('Acesso negado: usuário não tem permissão de master.')
      }
      // success
      if (onLogin) onLogin({ uid: user.uid, email: user.email, displayName: user.displayName })
    } catch (err) {
      console.error('Login error', err)
      alert('Falha no login: ' + (err.message || err.code || 'erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  // background image removed temporarily to avoid 404

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="relative z-10 w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <h1 className="text-2xl font-extrabold text-pink-600 mb-2">Mia Move</h1>
        <p className="text-sm text-gray-500 dark:text-gray-300 mb-6">Entre com sua conta para continuar</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full p-3 border rounded bg-white dark:bg-gray-700 dark:text-gray-50" placeholder="vc@exemplo.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Senha</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full p-3 border rounded bg-white dark:bg-gray-700 dark:text-gray-50" placeholder="••••••••" />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center text-sm"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} className="mr-2" /> Lembrar</label>
            <a className="text-sm text-pink-600 hover:underline" href="#">Esqueci a senha</a>
          </div>

          <button disabled={loading} type="submit" className="w-full py-3 bg-pink-500 text-white font-bold rounded-lg">{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>

  {/* footer note removed as requested */}
      </div>
    </div>
  )
}

export default LoginPage
