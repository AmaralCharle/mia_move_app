import React, { useState } from 'react'

const AIAdvisor = ({ db, userId, showToast = () => {} }) => {
  const [prompt, setPrompt] = useState('')
  const [answer, setAnswer] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleAsk = async () => {
    if (!prompt.trim()) return showToast('Digite sua pergunta.', 'error')
    setIsLoading(true)
    setAnswer(null)
    try {
  // point to local proxy server. In production you should route through your backend.
  // Vite exposes env vars via import.meta.env.VITE_*
  const proxy = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_AI_PROXY_URL) ? import.meta.env.VITE_AI_PROXY_URL : 'http://localhost:4321/api/ai'
      const res = await fetch(proxy, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const json = await res.json()
      if (!res.ok) {
        console.error('AI error', json)
        showToast(json.error || 'Erro do modelo', 'error')
        setAnswer({ text: json.detail || JSON.stringify(json) })
      } else {
        setAnswer({ text: json.text })
        showToast('Resposta recebida (via proxy).', 'success')
      }
    } catch (err) {
      console.error('Fetch error', err)
      showToast('Falha ao contactar o servidor de IA.', 'error')
      setAnswer({ text: 'Erro ao buscar resposta. Verifique se o servidor proxy está rodando e se a variável HF_API_KEY foi configurada.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
  <h2 className="text-2xl font-bold">Consultor - IA</h2>
      <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={4} className="w-full p-3 border rounded" placeholder="Descreva seu problema ou peça uma sugestão..."></textarea>
        <div className="flex items-center space-x-2 mt-3">
          <button onClick={handleAsk} className="px-4 py-2 bg-pink-500 text-white rounded">Perguntar</button>
          {isLoading && <span>Carregando...</span>}
        </div>
        {answer && <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded"><strong>Resposta:</strong><p className="mt-2">{answer.text}</p></div>}
      </div>
    </div>
  )
}

export default AIAdvisor
