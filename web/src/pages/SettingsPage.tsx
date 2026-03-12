import { useState } from 'react'

export default function SettingsPage() {
  const [copied, setCopied] = useState(false)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const embedUrl = `${baseUrl}/embed`
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="600" frameborder="0" title="Galton AI Chat"></iframe>`

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text-primary)' }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 600 }}>Configurações</h2>
      <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
        Configurações gerais do sistema. Gerencie representantes, usuários e preferências.
      </p>

      {/* Chat incorporado */}
      <div style={{ marginTop: 28, padding: 24, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, maxWidth: 640 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>Chat incorporado</h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          Use as informações abaixo para incorporar o Chat IA em Power BI, SharePoint ou outras aplicações que suportem iframe.
        </p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>URL do embed</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{
              flex: 1, padding: '10px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 8, fontSize: 13, fontFamily: 'var(--font-mono)', wordBreak: 'break-all',
            }}>
              {embedUrl}
            </code>
            <button
              type="button"
              onClick={() => copyToClipboard(embedUrl)}
              style={{
                padding: '8px 14px', background: copied ? 'var(--color-success)' : 'var(--color-accent)',
                color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--color-text-secondary)' }}>Código iframe (HTML)</label>
          <div style={{ position: 'relative' }}>
            <pre style={{
              margin: 0, padding: '12px 14px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
              borderRadius: 8, fontSize: 12, fontFamily: 'var(--font-mono)', overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {iframeCode}
            </pre>
            <button
              type="button"
              onClick={() => copyToClipboard(iframeCode)}
              style={{
                position: 'absolute', top: 8, right: 8,
                padding: '6px 12px', background: copied ? 'var(--color-success)' : 'var(--color-accent)',
                color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>

        <div style={{ padding: '14px 16px', background: 'var(--color-accent-dim)', borderRadius: 8, border: '1px solid var(--color-accent-light)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
            <strong>Power BI:</strong> Adicione um visual "Web content" ou "Incorporar" e cole a URL do embed.
          </p>
        </div>
        <div style={{ marginTop: 12, padding: '14px 16px', background: 'var(--color-accent-dim)', borderRadius: 8, border: '1px solid var(--color-accent-light)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
            <strong>SharePoint:</strong> Adicione o web part "Incorporar" e cole o código iframe acima.
          </p>
        </div>
        <div style={{ marginTop: 12, padding: '14px 16px', background: 'var(--color-accent-dim)', borderRadius: 8, border: '1px solid var(--color-accent-light)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>
            <strong>Outras aplicações:</strong> Use o código iframe onde o embed de páginas web for suportado. O usuário precisará fazer login na primeira vez dentro do iframe.
          </p>
        </div>
      </div>
    </div>
  )
}
