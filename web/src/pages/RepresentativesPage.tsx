import { useEffect, useState } from 'react'
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Representative {
  id: string
  name: string
  territory_code: string | null
  email: string | null
  manager_district: string | null
  manager_regional: string | null
  login_count: number
  message_count: number
}

export default function RepresentativesPage() {
  const [reps, setReps] = useState<Representative[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    axios
      .get<Representative[]>(`${API_URL}/api/representatives`)
      .then(r => setReps(r.data))
      .catch(() => setError('Erro ao carregar representantes.'))
      .finally(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <div role="alert" style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: 'var(--color-danger)', borderRadius: 8, padding: '12px 16px', fontSize: 13, fontFamily: 'var(--font-body)' }}>
        {error}
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 20, color: 'var(--color-text-primary)', margin: '0 0 8px' }}>
        Representantes
      </h2>
      <p style={{ margin: '0 0 20px', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)' }}>
        Controle de acessos, logins e mensagens enviadas por representante.
      </p>

      {loading ? (
        <div style={{ padding: 24, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-muted)' }}>
          Carregando…
        </div>
      ) : (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Nome</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Território</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>E-mail</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Logins</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Mensagens</th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: i < reps.length - 1 ? '1px solid var(--color-border)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.name}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.territory_code ?? '—'}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--color-text-secondary)' }}>{r.email ?? '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>{r.login_count}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent)' }}>{r.message_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {reps.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Nenhum representante cadastrado.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
