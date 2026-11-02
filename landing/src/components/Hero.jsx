import React, { useEffect, useRef } from 'react'
import { Chrome, Github } from 'lucide-react'
import { GITHUB_URL, INSTALL_HREF } from '../config'

// Particle canvas (unchanged)
function ParticleCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const particles = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.5 + 0.3, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.1,
      color: Math.random() > 0.6 ? '#00ff88' : Math.random() > 0.5 ? '#4f8cff' : '#9b59f5',
    }))
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const p of particles) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color; ctx.globalAlpha = p.opacity; ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
      }
      ctx.globalAlpha = 1
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize) }
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
}

function PopupMock() {
  return (
    <div className="ls-card" style={{ padding: 0, maxWidth: 380, width: '100%', justifySelf: 'center', boxShadow: '0 40px 80px rgba(0,0,0,.5)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
        <b>⚡ LeetSync</b><span style={{ color: 'var(--accent-green)', fontSize: '.72rem' }}>● Ready</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: 16 }}>
        {[['Today', 3], ['This week', 12], ['Streak', 21], ['Solved', 147]].map(([l, v]) => (
          <div key={l} className="ls-card" style={{ padding: '10px 12px' }}>
            <div className="ls-mono">{l}</div><div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="ls-mono" style={{ padding: '0 16px 16px' }}>
        <div style={{ color: 'var(--accent-green)' }}>✓ Synced · Add Binary</div>
        <div>feat(string): simulate binary addition using two pointers and carry</div>
        <div style={{ color: 'var(--text-muted)' }}>LeetCode/0067-add-binary/solution.py</div>
        <div style={{ color: 'var(--text-muted)', marginTop: 8 }}>Sample data</div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden', paddingTop: 80 }}>
      <ParticleCanvas />
      <div className="orb orb-green" style={{ width: 600, height: 600, top: -100, left: -200 }} />
      <div className="orb orb-blue" style={{ width: 500, height: 500, bottom: -100, right: -150 }} />
      <div className="orb orb-purple" style={{ width: 400, height: 400, top: '40%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, backgroundImage: 'linear-gradient(rgba(0,255,136,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      <div className="ls-wrap ls-hero-grid" style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 56, alignItems: 'center', padding: '60px 24px 80px', width: '100%' }}>
        <div>
          <div className="ls-eyebrow">Browser extension · LeetCode → GitHub</div>
          <h1 style={{ fontSize: 'clamp(2.4rem,5vw,4rem)', lineHeight: 1.05, letterSpacing: '-.04em', marginBottom: 22 }}>
            Every accepted solution, committed to your repo.
          </h1>
          <p className="ls-sub" style={{ marginBottom: 32 }}>
            LeetSync pushes each Accepted submission to your own GitHub repository with a README, your notes, and a commit message that describes the approach. No copy-pasting, nothing lost.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a className="btn-primary" href={INSTALL_HREF}><Chrome size={17} /> Get the extension</a>
            <a className="btn-secondary" href={GITHUB_URL} target="_blank" rel="noreferrer"><Github size={17} /> View source</a>
          </div>
          <div className="ls-mono" style={{ marginTop: 28 }}>Open source · your token stays in your browser · Chromium browsers</div>
        </div>
        <PopupMock />
      </div>
    </section>
  )
}