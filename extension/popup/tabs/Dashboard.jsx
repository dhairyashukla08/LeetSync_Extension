import React, { useState, useEffect } from 'react'

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: '12px 14px',
}

const mockLogs = [
  { problemTitle: 'Two Sum', difficulty: 'Easy', syncedAt: new Date(Date.now() - 120000).toISOString(), status: 'success' },
  { problemTitle: 'Longest Substring', difficulty: 'Medium', syncedAt: new Date(Date.now() - 3600000).toISOString(), status: 'success' },
  { problemTitle: 'Valid Parentheses', difficulty: 'Easy', syncedAt: new Date(Date.now() - 7200000).toISOString(), status: 'success' },
]

const diffColor = { Easy: '#00ff88', Medium: '#ffab00', Hard: '#ff4444' }

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60) return `${Math.round(diff)}s ago`
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

export default function Dashboard() {
  const [stats, setStats] = useState({ total: 0, today: 0, week: 0, streak: 0, easy: 0, medium: 0, hard: 0, logs: [] })

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'GET_STATS' }, (resp) => {
        if (resp) setStats(resp)
      })
    } else {
      // Dev mode mock
      setStats({ total: 147, today: 3, week: 12, streak: 21, easy: 54, medium: 69, hard: 24, logs: mockLogs })
    }
  }, [])

  const statCards = [
    { label: 'Today', value: stats.today, color: '#00ff88', icon: '✅' },
    { label: 'This Week', value: stats.week, color: '#4f8cff', icon: '📈' },
    { label: 'Total', value: stats.total, color: '#9b59f5', icon: '🏆' },
    { label: 'Streak', value: stats.streak ?? 0, color: '#ff7b42', icon: '🔥' },
  ]

  return (
    <div>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {statCards.map(({ label, value, color, icon }) => (
          <div key={label} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.68rem', color: 'rgba(240,246,255,0.4)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: 13 }}>{icon}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Difficulty breakdown */}
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,246,255,0.5)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Difficulty Breakdown
        </div>
        {[
  { label: 'Easy', val: stats.easy || 0 },
  { label: 'Medium', val: stats.medium || 0 },
  { label: 'Hard', val: stats.hard || 0 },
].map(({ label, val }) => {
  const pct = stats.total ? Math.round((val / stats.total) * 100) : 0
  return (
    <div key={label} style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.72rem', color: diffColor[label], fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '0.72rem', color: 'rgba(240,246,255,0.5)', fontFamily: 'JetBrains Mono' }}>{val}</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }}>
        <div style={{ height: 4, borderRadius: 2, background: diffColor[label], width: `${pct}%`, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
})}
      </div>

      {/* Recent syncs */}
      <div style={{ ...card }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(240,246,255,0.5)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Recent Syncs
        </div>
        {(stats.logs || []).length === 0 && (
          <div style={{ fontSize: '0.8rem', color: 'rgba(240,246,255,0.3)', textAlign: 'center', padding: '12px 0' }}>
            No syncs yet. Solve a problem on LeetCode!
          </div>
        )}
        {(stats.logs || []).slice(0, 5).map((log, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: i < Math.min(stats.logs.length, 5) - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: log.status === 'success' ? '#00ff88' : '#ff4444', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f0f6ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.problemTitle}</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(240,246,255,0.35)', fontFamily: 'JetBrains Mono' }}>{timeAgo(log.syncedAt)}</div>
            </div>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${diffColor[log.difficulty] || '#888'}20`, color: diffColor[log.difficulty] || '#888' }}>
              {log.difficulty}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
