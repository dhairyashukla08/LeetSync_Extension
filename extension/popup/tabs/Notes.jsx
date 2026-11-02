import React, { useState, useEffect } from 'react'

const card = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  padding: '12px 14px',
}

const TEMPLATES = [
  { label: 'Core Intuition', placeholder: 'e.g. Use a hashmap to track complements...' },
  { label: 'Edge Cases', placeholder: 'e.g. Empty array, duplicates, overflow...' },
  { label: 'Time Complexity', placeholder: 'e.g. O(n)' },
  { label: 'Space Complexity', placeholder: 'e.g. O(n)' },
  { label: 'Alternative Approaches', placeholder: 'e.g. Brute force: O(n²), sorted + two pointers...' },
]

export default function Notes() {
  const [slug, setSlug] = useState('')
  const [content, setContent] = useState('')
  const [fields, setFields] = useState({ coreIntuition: '', edgeCases: '', timeComplexity: '', spaceComplexity: '', alternativeApproaches: '' })
  const [activeMode, setActiveMode] = useState('free') // 'free' | 'structured'
  const [saved, setSaved] = useState(false)
  const [reviewDays, setReviewDays] = useState(null)

  useEffect(() => {
    // Get current tab slug
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs[0]?.url || ''
        const m = url.match(/\/problems\/([^/]+)/)
        if (m) {
          const s = m[1]
          setSlug(s)
          loadNote(s)
        }
      })
    } else {
      setSlug('two-sum')
      setContent(`## Core Intuition\nUse a hashmap to track complements.\n\n## Edge Cases\n- Duplicates\n- No solution (guaranteed)`)
    }
  }, [])

  const loadNote = (s) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(`note_${s}`, (data) => {
        const note = data[`note_${s}`] || {}
        setContent(note.content || '')
        setFields({
          coreIntuition: note.coreIntuition || '',
          edgeCases: note.edgeCases || '',
          timeComplexity: note.timeComplexity || '',
          spaceComplexity: note.spaceComplexity || '',
          alternativeApproaches: note.alternativeApproaches || '',
        })
      })
    }
  }

  const saveNote = () => {
    const note = { content, ...fields, slug, updatedAt: new Date().toISOString() }
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [`note_${slug}`]: note })
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const scheduleReview = (days) => {
    setReviewDays(days)
    if (typeof chrome !== 'undefined' && chrome.alarms) {
      chrome.alarms.create(`review_${slug}`, { delayInMinutes: days * 24 * 60 })
    }
  }

  const inputStyle = {
    width: '100%', background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7, padding: '8px 10px',
    color: '#f0f6ff', fontSize: '0.78rem',
    fontFamily: 'JetBrains Mono', lineHeight: 1.6,
    outline: 'none', transition: 'border-color 0.2s ease',
  }

  return (
    <div>
      {/* Slug header */}
      {slug && (
        <div style={{ fontSize: '0.7rem', color: 'rgba(240,246,255,0.4)', fontFamily: 'JetBrains Mono', marginBottom: 12 }}>
          📌 {slug}
        </div>
      )}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['free', 'structured'].map(mode => (
          <button key={mode} onClick={() => setActiveMode(mode)} style={{
            flex: 1, padding: '6px 0', borderRadius: 7, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
            background: activeMode === mode ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
            border: activeMode === mode ? '1px solid rgba(0,255,136,0.3)' : '1px solid rgba(255,255,255,0.07)',
            color: activeMode === mode ? '#00ff88' : 'rgba(240,246,255,0.5)',
            transition: 'all 0.2s ease',
          }}>
            {mode === 'free' ? '✏️ Free Notes' : '📋 Template'}
          </button>
        ))}
      </div>

      {activeMode === 'free' ? (
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write markdown notes here...&#10;&#10;## Core Intuition&#10;## Edge Cases&#10;## Complexity"
          style={{ ...inputStyle, minHeight: 200, marginBottom: 12 }}
          onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.4)'}
          onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {TEMPLATES.map(({ label, placeholder }, i) => {
            const key = ['coreIntuition', 'edgeCases', 'timeComplexity', 'spaceComplexity', 'alternativeApproaches'][i]
            return (
              <div key={key}>
                <div style={{ fontSize: '0.68rem', color: 'rgba(240,246,255,0.4)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <textarea rows={i < 2 ? 2 : 1} value={fields[key]} onChange={e => setFields({ ...fields, [key]: e.target.value })}
                  placeholder={placeholder} style={{ ...inputStyle, resize: 'none' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,255,136,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Save button */}
      <button onClick={saveNote} style={{
        width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
        background: saved ? 'rgba(0,255,136,0.2)' : 'linear-gradient(135deg,#00ff88,#4f8cff)',
        color: saved ? '#00ff88' : '#050b14',
        fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
        transition: 'all 0.25s ease', marginBottom: 12,
      }}>
        {saved ? '✓ Saved!' : '💾 Save Notes'}
      </button>

      {/* Review scheduling */}
      <div style={{ ...card }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'rgba(240,246,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
          ⏰ Schedule Review
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[3, 7, 30].map(days => (
            <button key={days} onClick={() => scheduleReview(days)} style={{
              flex: 1, padding: '6px 4px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer',
              background: reviewDays === days ? 'rgba(255,171,0,0.2)' : 'rgba(255,255,255,0.04)',
              border: reviewDays === days ? '1px solid rgba(255,171,0,0.4)' : '1px solid rgba(255,255,255,0.08)',
              color: reviewDays === days ? '#ffab00' : 'rgba(240,246,255,0.5)',
              transition: 'all 0.2s ease',
            }}>
              {days}d
            </button>
          ))}
        </div>
        {reviewDays && <div style={{ fontSize: '0.65rem', color: 'rgba(0,255,136,0.7)', marginTop: 6 }}>✓ Review scheduled in {reviewDays} days</div>}
      </div>
    </div>
  )
}
