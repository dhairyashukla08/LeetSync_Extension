import React from 'react'
import { GITHUB_URL, PRIVACY_URL } from '../config'

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border)', padding: '36px 0' }}>
      <div className="ls-wrap" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <b>Leet<span style={{ color: 'var(--accent-green)' }}>Sync</span></b>
        <div className="ls-mono" style={{ display: 'flex', gap: 24 }}>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          <a href={PRIVACY_URL}>Privacy</a>
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">Report an issue</a>
        </div>
        <span className="ls-mono">Open source · not affiliated with LeetCode or GitHub</span>
      </div>
    </footer>
  )
}