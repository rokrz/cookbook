import { useState, type FormEvent } from 'react'
import { BookOpen } from 'lucide-react'
import { pb } from '../lib/pb'
import { errorMessage } from '../lib/errors'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await pb.collection('users').authWithPassword(email.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <BookOpen size={40} className="login-icon" aria-hidden />
        <h1>Meu Caderno de Receitas</h1>
        <p className="muted">Entre para abrir o seu caderno.</p>
        <label>
          E-mail
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="muted small">As contas são criadas pelo administrador do caderno.</p>
      </form>
    </div>
  )
}
