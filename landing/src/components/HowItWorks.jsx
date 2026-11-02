import React from 'react'
import { INSTALL_HREF } from '../config'

const steps = [
  ['01', 'Install', 'Add the extension to your browser.'],
  ['02', 'Connect', 'Log in to LeetCode as usual, then connect GitHub with a code and choose a repo. About a minute.'],
  ['03', 'Solve', 'Submit on LeetCode. When it says Accepted, the commit is already on its way.'],
]

export default function HowItWorks() {
  return (
    <section className="ls-sec" id="how-it-works" style={{ paddingTop: 0 }}>
      <div className="ls-wrap">
        <div className="reveal">
          <div className="ls-eyebrow">03 / Setup</div>
          <h2 className="ls-h2">Three steps, then forget it.</h2>
        </div>
        <div className="ls-steps reveal" style={{ marginTop: 40 }}>
          {steps.map(([n, t, d]) => (
            <div className="ls-step" key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
        <div className="ls-card reveal" id="install" style={{ marginTop: 40 }}>
          <h3>Install</h3>
          <p>The Chrome Web Store listing is coming. Until then, load it manually in any Chromium browser:</p>
          <div className="ls-pre ls-mono">{'1. Build:  cd extension/popup && npm install && npm run build\n2. Open brave://extensions (or chrome://extensions) and turn on Developer mode\n3. Load unpacked → choose the dist folder'}</div>
          <a className="btn-primary" href={INSTALL_HREF} style={{ marginTop: 18, display: 'inline-flex' }}>Get the extension</a>
        </div>
      </div>
    </section>
  )
}