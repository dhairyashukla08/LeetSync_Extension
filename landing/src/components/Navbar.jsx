import React, { useState, useEffect } from 'react'
import { Github, Zap, Menu, X } from 'lucide-react'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

const links = [
  { label: 'Features', href: '#features' },
  { label: 'Your repo', href: '#structure' },
  { label: 'Setup', href: '#how-it-works' },
  { label: 'Privacy', href: '#trust' },
]

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '0 0',
      transition: 'all 0.3s ease',
    }}>
      <div style={{
        background: scrolled ? 'rgba(5, 11, 20, 0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(24px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
          {/* Logo */}
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #00ff88, #4f8cff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(0,255,136,0.3)',
            }}>
              <Zap size={18} color="#050b14" strokeWidth={2.5} />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
              Leet<span style={{ color: 'var(--accent-green)' }}>Sync</span>
            </span>
          </a>

          {/* Desktop Nav */}
          <nav style={{ display: 'flex', gap: 32, alignItems: 'center' }} className="desktop-nav">
            {links.map(l => (
              <a key={l.label} href={l.href} style={{
                fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)',
                transition: 'color 0.2s ease',
              }}
                onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
                onMouseLeave={e => e.target.style.color = 'var(--text-secondary)'}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="https://github.com" target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', transition: 'all 0.2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-green)'; e.currentTarget.style.color = 'var(--accent-green)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <Github size={15} /> Star
            </a>
            <a href="#install" className="btn-primary" style={{ padding: '9px 20px', fontSize: '0.88rem' }}>
              Get Extension
            </a>
            <button onClick={() => setMenuOpen(!menuOpen)}
              style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}
              className="menu-btn" aria-label="Toggle menu"
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{
            padding: '16px 24px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', gap: 16,
            background: 'rgba(5, 11, 20, 0.97)',
          }}>
            {links.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {l.label}
              </a>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  )
}
