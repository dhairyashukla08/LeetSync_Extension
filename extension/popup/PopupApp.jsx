import React, { useState, useEffect } from 'react'
import Dashboard from './tabs/Dashboard.jsx'
import Notes from './tabs/Notes.jsx'
import Settings from './tabs/Settings.jsx'
import SyncLog from './tabs/SyncLog.jsx'
import { send } from './api.js'

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'notes', label: '📝 Notes' },
  { id: 'settings', label: '⚙️ Setup' },
  { id: 'log', label: '📜 Log' },
]

const s = {
  wrapper: { width: 380, minHeight: 520, background: '#080f1c', display: 'flex', flexDirection: 'column' },
  header: {
    padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'rgba(0,255,136,0.04)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 30, height: 30, borderRadius: 8,
    background: 'linear-gradient(135deg, #00ff88, #4f8cff)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 14, boxShadow: '0 0 14px rgba(0,255,136,0.3)',
  },
  logoText: { fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.01em' },
  badge: (ok) => ({
    display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', fontWeight: 600,
    color: ok ? '#00ff88' : '#ffab00',
  }),
  dot: (ok) => ({
    width: 6, height: 6, borderRadius: '50%', background: ok ? '#00ff88' : '#ffab00',
    boxShadow: `0 0 6px ${ok ? 'rgba(0,255,136,0.8)' : 'rgba(255,171,0,0.8)'}`,
    animation: 'pulse 2s infinite',
  }),
  tabs: { display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  tab: (active) => ({
    flex: 1, padding: '9px 0', fontSize: '0.7rem', fontWeight: 600,
    background: 'none', border: 'none', cursor: 'pointer',
    color: active ? '#00ff88' : 'rgba(240,246,255,0.4)',
    borderBottom: active ? '2px solid #00ff88' : '2px solid transparent',
    transition: 'all 0.2s ease', whiteSpace: 'nowrap',
  }),
  body: { flex: 1, padding: '14px 16px', overflowY: 'auto', maxHeight: 440 },
}

export default function PopupApp() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [status, setStatus] = useState(null) // { lc, gh }

  useEffect(() => {
    Promise.all([send('LC_STATUS'), send('GH_STATUS')]).then(([lc, gh]) => {
      setStatus({ lc, gh })
      // First run / not fully set up → go straight to setup
      if (!lc.loggedIn || !gh.connected || !gh.repo) setActiveTab('settings')
    })
  }, [])

  const ready = !!(status?.lc?.loggedIn && status?.gh?.connected && status?.gh?.repo)

  return (
    <div style={s.wrapper}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        button:hover { opacity: 0.9; }
        input, select { outline: none; }
        textarea { outline: none; resize: vertical; }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,136,0.3); border-radius: 2px; }
      `}</style>

      <div style={s.header}>
        <div style={s.logo}>
          <div style={s.logoIcon}>⚡</div>
          <span style={s.logoText}>Leet<span style={{ color: '#00ff88' }}>Sync</span></span>
        </div>
        <div style={s.badge(ready)}>
          <div style={s.dot(ready)} />
          {ready ? 'Ready' : 'Setup needed'}
        </div>
      </div>

      <div style={s.tabs}>
        {TABS.map(t => (
          <button key={t.id} style={s.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={s.body}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'notes' && <Notes />}
        {activeTab === 'settings' && <Settings onStatus={setStatus} />}
        {activeTab === 'log' && <SyncLog />}
      </div>
    </div>
  )
}