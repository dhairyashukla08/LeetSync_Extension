import React, { useEffect } from 'react'
import './landing.css'
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Features from './components/Features'
import FolderDemo from './components/FolderDemo'
import HowItWorks from './components/HowItWorks'
import Trust from './components/Trust'
import Footer from './components/Footer'

export default function App() {
  // Scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="noise-bg" style={{ position: 'relative', minHeight: '100vh' }}>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <FolderDemo />
        <HowItWorks />
        <Trust />
      </main>
      <Footer />
    </div>
  )
}