import React, { useState } from 'react'

const presets = [
  ['Default', 'LeetCode/0001-two-sum/'],
  ['By difficulty', 'LeetCode/Easy/0001-two-sum/'],
  ['By topic', 'LeetCode/Array/0001-two-sum/'],
  ['By language', 'LeetCode/python3/0001-two-sum/'],
  ['Every language', 'LeetCode/0001-two-sum/python3/'],
]

export default function FolderDemo() {
  const [i, setI] = useState(1)
  const path = presets[i][1]
  return (
    <section className="ls-sec" id="structure" style={{ paddingTop: 0 }}>
      <div className="ls-wrap ls-two reveal">
        <div>
          <div className="ls-eyebrow">02 / Your repo</div>
          <h2 className="ls-h2">Your repo, laid out your way.</h2>
          <p className="ls-sub" style={{ marginBottom: 24 }}>Pick a layout in the popup. New solutions follow it, and the preview shows the exact path before you commit to it.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {presets.map(([label], n) => (
              <button key={label} className={`ls-chip ${n === i ? 'on' : ''}`} onClick={() => setI(n)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="ls-card">
          <div className="ls-mono" style={{ color: 'var(--text-muted)' }}>your-repo/</div>
          <div className="ls-pre ls-mono" style={{ marginTop: 10 }}>
            {path.split('/').filter(Boolean).map((p, d) => '  '.repeat(d) + '└ ' + p + '/').join('\n')}
            {'\n' + '  '.repeat(path.split('/').filter(Boolean).length) + '├ solution.py\n' + '  '.repeat(path.split('/').filter(Boolean).length) + '└ README.md'}
          </div>
        </div>
      </div>
    </section>
  )
}