import React, { useState, useEffect, useCallback } from 'react'
import { send } from '../api.js'

const diffColor = { Easy: '#00ff88', Medium: '#ffab00', Hard: '#ff4444' }
const statusColor = { success: '#00ff88', failed: '#ff4444', skipped: '#ffab00' }

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

const mockLogs = [
  { problemTitle: 'Two Sum', difficulty: 'Easy', language: 'python', runtime: '52 ms', syncedAt: new Date(Date.now() - 120000).toISOString(), status: 'success', commitUrl: '#' },
  { problemTitle: 'Merge Intervals', difficulty: 'Medium', language: 'python', runtime: '110 ms', syncedAt: new Date(Date.now() - 90000000).toISOString(), status: 'failed', errorMessage: 'Network error', qkey: 'merge-intervals_python', commitUrl: '' },
]

const filters = ['all', 'success', 'failed']

export default function SyncLog() {
  const [logs, setLogs] = useState([])
  const [queue, setQueue] = useState({})
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['syncLogs', 'retryQueue'], d => {
        setLogs(d.syncLogs || [])
        setQueue(d.retryQueue || {})
      })
    } else {
      setLogs(mockLogs)
    }
  }, [])

  // Live updates: the service worker retries in the background
  useEffect(() => {
    load()
    if (typeof chrome === 'undefined' || !chrome.storage) return
    const onChange = (_c, area) => { if (area === 'local') load() }
    chrome.storage.onChanged.addListener(onChange)
    return () => chrome.storage.onChanged.removeListener(onChange)
  }, [load])

  const retry = async (qkey) => {
    setBusy(qkey)
    setNote('')
    const r = await send('RETRY_SYNC', { qkey })
    if (!r.ok) setNote(r.error || 'Retry failed')
    setBusy('')
  }

  const retryAll = async () => {
    setBusy('all')
    setNote('')
    const r = await send('RETRY_ALL')
    if (r.ok === false) setNote(r.error || 'Retry failed')
    else setNote(`Retried: ${r.done || 0} synced, ${r.failed || 0} still failing`)
    setBusy('')
  }

  const pending = Object.keys(queue).length
  const filtered = logs.filter(l => filter === 'all' || l.status === filter)

  return (
    <div>
      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '4px 12px', borderRadius: 20, fontSize: '0.68rem', fontWeight: 700,
            cursor: 'pointer', textTransform: 'capitalize',
            background: filter === f ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
            border: filter === f ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.06)',
            color: filter === f ? '#00ff88' : 'rgba(240,246,255,0.4)',
            transition: 'all 0.2s ease',
          }}>
            {f}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'rgba(240,246,255,0.3)', display: 'flex', alignItems: 'center' }}>
          {filtered.length} entries
        </span>
      </div>

      {/* Retry all */}
      {pending > 0 && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={retryAll} disabled={busy === 'all'} style={{
            width: '100%', padding: '8px 0', borderRadius: 8, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
            background: 'rgba(255,171,0,0.12)', border: '1px solid rgba(255,171,0,0.35)', color: '#ffab00',
          }}>
            {busy === 'all' ? 'Retrying…' : `⟳ Retry all (${pending} waiting)`}
          </button>
          <div style={{ fontSize: '0.64rem', color: 'rgba(240,246,255,0.35)', marginTop: 4 }}>
            Waiting solutions are also retried automatically.
          </div>
        </div>
      )}
      {note && (
        <div style={{ fontSize: '0.7rem', color: 'rgba(240,246,255,0.6)', marginBottom: 10 }}>{note}</div>
      )}

      {/* Log entries */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {filtered.length === 0 && (
          <div style={{ fontSize: '0.8rem', color: 'rgba(240,246,255,0.2)', textAlign: 'center', padding: '24px 0' }}>
            No sync logs yet.
          </div>
        )}
        {filtered.map((log, i) => {
          const canRetry = log.status === 'failed' && log.qkey && queue[log.qkey]
          return (
            <div key={i} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 9, padding: '10px 12px',
              borderLeft: `2px solid ${statusColor[log.status] || '#888'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f0f6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                  {log.problemTitle}
                </span>
                <span style={{
                  fontSize: '0.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: `${diffColor[log.difficulty] || '#888'}20`,
                  color: diffColor[log.difficulty] || '#888',
                }}>
                  {log.difficulty}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: '0.65rem', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(240,246,255,0.4)' }}>
                  {log.language} · {log.runtime}
                </span>
                <span style={{ fontSize: '0.62rem', color: 'rgba(240,246,255,0.25)', marginLeft: 'auto' }}>
                  {timeAgo(log.syncedAt)}
                </span>
                {log.commitUrl && log.status === 'success' && (
                  <a href={log.commitUrl} target="_blank" rel="noreferrer" style={{
                    fontSize: '0.62rem', color: '#4f8cff', textDecoration: 'none',
                    border: '1px solid rgba(79,140,255,0.25)', borderRadius: 4, padding: '1px 6px',
                  }}>
                    View ↗
                  </a>
                )}
                {canRetry && (
                  <button onClick={() => retry(log.qkey)} disabled={busy === log.qkey} style={{
                    fontSize: '0.62rem', fontWeight: 700, color: '#ffab00', cursor: 'pointer',
                    background: 'rgba(255,171,0,0.1)', border: '1px solid rgba(255,171,0,0.35)',
                    borderRadius: 4, padding: '1px 8px',
                  }}>
                    {busy === log.qkey ? '…' : '⟳ Retry'}
                  </button>
                )}
              </div>

              {log.status === 'failed' && log.errorMessage && (
                <div title={log.errorMessage} style={{ fontSize: '0.64rem', color: '#ff4444', marginTop: 5, lineHeight: 1.4 }}>
                  ❌ {log.errorMessage.length > 110 ? log.errorMessage.slice(0, 110) + '…' : log.errorMessage}
                  {canRetry && queue[log.qkey].attempts >= 6 ? ' (auto-retry stopped; use Retry)' : ''}
                </div>
              )}
              {log.status === 'skipped' && log.errorMessage && (
                <div style={{ fontSize: '0.64rem', color: '#ffab00', marginTop: 5 }}>{log.errorMessage}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}