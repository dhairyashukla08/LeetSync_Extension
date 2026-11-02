/**
 * LeetSync — Content Script (isolated world)
 * - Listens for "judging finished" events from inject.js
 * - Fetches full submission details (code, runtime, memory...) from LeetCode GraphQL
 *   using the user's own logged-in session, then hands them to the service worker
 * - Timer + Notes button on problem pages (works with LeetCode's SPA navigation)
 * - Reports the logged-in LeetCode username to the extension
 */
;(function () {
  'use strict'
  console.log('[LeetSync] content script loaded (v4)')

  const Q_USER = `query globalData { userStatus { isSignedIn username } }`
  const Q_QUESTION = `query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) { questionFrontendId title titleSlug difficulty topicTags { name } }
  }`
  const Q_SUBMISSION = `query submissionDetails($submissionId: Int!) {
    submissionDetails(submissionId: $submissionId) {
      runtimeDisplay runtimePercentile memoryDisplay memoryPercentile code
      statusCode timestamp
      lang { name verboseName }
    }
  }`

  let startTime = Date.now()
  let currentSlug = ''
  const seen = new Set()

  const getSlug = () => (location.pathname.match(/^\/problems\/([^/]+)/) || [])[1] || ''
  const isProblemPage = () => !!getSlug()
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const pad = n => String(n).padStart(2, '0')

  // ── GraphQL (same-origin, uses the user's LeetCode cookies) ──
  async function gql(query, variables = {}) {
    const csrf = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1]
    const r = await fetch('/graphql', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrftoken': csrf } : {}) },
      body: JSON.stringify({ query, variables }),
    })
    const j = await r.json()
    if (j.errors) throw new Error(j.errors[0].message)
    return j.data
  }

  async function retry(fn, tries = 5, delay = 1000) {
    let last
    for (let i = 0; i < tries; i++) {
      try { return await fn() } catch (e) { last = e; await sleep(delay) }
    }
    throw last
  }

  // ── Judge finished → fetch details → sync if Accepted ────────
  async function handleSubmission(submissionId) {
    if (seen.has(submissionId)) return
    seen.add(submissionId)
    console.log('[LeetSync] handling submission', submissionId)

    const slug = getSlug()
    if (!slug) { console.log('[LeetSync] no problem slug in URL, skipping'); return }

    try {
      const timeTaken = Math.round((Date.now() - startTime) / 1000)

      const { question: q } = await gql(Q_QUESTION, { titleSlug: slug })
      console.log('[LeetSync] question', q && q.title)

      const s = await retry(async () => {
        const d = (await gql(Q_SUBMISSION, { submissionId: Number(submissionId) })).submissionDetails
        if (!d || !d.code) throw new Error('Submission details not ready')
        return d
      })
      console.log('[LeetSync] details', { statusCode: s.statusCode, lang: s.lang && s.lang.name, hasCode: !!s.code })

      if (s.statusCode !== 10) {
        console.log('[LeetSync] not Accepted, nothing to sync')
        return
      }

      const payload = {
        problemSlug: slug,
        problemId: Number(q.questionFrontendId) || 0,
        problemTitle: q.title,
        difficulty: q.difficulty,
        tags: (q.topicTags || []).map(t => t.name),
        language: (s.lang && s.lang.name) || '',
        runtime: s.runtimeDisplay || '',
        runtimePercentile: Number(s.runtimePercentile) || 0,
        memory: s.memoryDisplay || '',
        memoryPercentile: Number(s.memoryPercentile) || 0,
        code: s.code,
        timeTaken,
      }

      console.log('[LeetSync] sending to background')
      const resp = await chrome.runtime.sendMessage({ type: 'SYNC_SUBMISSION', payload })
      console.log('[LeetSync] background replied', resp)

      if (resp && resp.skipped) showToast('⏭ Skipped — not better than your best submission', '#ffab00')
      else if (resp && resp.ok) showToast('✅ Synced to GitHub!', '#00ff88')
      else showToast('❌ ' + ((resp && resp.error) || 'Sync failed (no response from extension)'), '#ff4444')
    } catch (err) {
      console.error('[LeetSync]', err)
      const msg = /context invalidated/i.test(err.message)
        ? 'Extension was reloaded — refresh this page and submit again'
        : err.message
      showToast('❌ LeetSync: ' + msg, '#ff4444')
    }
  }

  window.addEventListener('message', e => {
    if (e.source !== window || !e.data || e.data.source !== 'leetsync') return
    if (e.data.type === 'SUBMISSION_ACCEPTED') {
      console.log('[LeetSync] event received', e.data.submissionId)
      handleSubmission(String(e.data.submissionId))
    }
  })

  // ── Report logged-in LeetCode user ───────────────────────────
  gql(Q_USER)
    .then(d => {
      const u = d.userStatus
      chrome.runtime.sendMessage({ type: 'LC_USER', username: u && u.isSignedIn ? u.username : '' })
    })
    .catch(() => {})

  // ── UI: timer + notes button ─────────────────────────────────
  function injectUI() {
    if (document.getElementById('leetsync-timer')) return

    const timer = document.createElement('div')
    timer.id = 'leetsync-timer'
    timer.style.cssText = `
      position: fixed; bottom: 80px; right: 20px; z-index: 9999;
      background: rgba(5,11,20,0.92); border: 1px solid rgba(0,255,136,0.3);
      border-radius: 12px; padding: 10px 16px;
      font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #00ff88;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4); user-select: none;
      display: flex; align-items: center; gap: 8px;`
    timer.innerHTML = `<span style="opacity:.6;font-size:10px">⏱ LeetSync</span><span id="leetsync-time">00:00</span>`
    document.body.appendChild(timer)

    const btn = document.createElement('button')
    btn.id = 'leetsync-notes-btn'
    btn.textContent = '📝 Notes'
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
      background: linear-gradient(135deg, #00ff88, #4f8cff); color: #050b14;
      border: none; border-radius: 10px; padding: 10px 18px;
      font-weight: 700; font-size: 13px; cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,255,136,0.25);`
    btn.onclick = () => chrome.runtime.sendMessage({ type: 'OPEN_NOTES' })
    document.body.appendChild(btn)
  }

  function removeUI() {
    const t = document.getElementById('leetsync-timer')
    const b = document.getElementById('leetsync-notes-btn')
    if (t) t.remove()
    if (b) b.remove()
  }

  function showToast(message, color = '#00ff88') {
    const toast = document.createElement('div')
    toast.style.cssText = `
      position: fixed; top: 80px; right: 20px; z-index: 99999;
      background: rgba(5,11,20,0.95); border: 1px solid ${color}; color: ${color};
      padding: 12px 20px; border-radius: 10px; max-width: 360px;
      font-family: Inter, sans-serif; font-size: 14px; font-weight: 600;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);`
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 5000)
  }

  // LeetCode is a single-page app: poll the URL so the timer resets per problem
  function tick() {
    const slug = getSlug()
    if (slug !== currentSlug) {
      currentSlug = slug
      startTime = Date.now()
    }
    if (isProblemPage() && document.body) {
      injectUI()
      const el = document.getElementById('leetsync-time')
      if (el) {
        const e = Math.floor((Date.now() - startTime) / 1000)
        el.textContent = `${pad(Math.floor(e / 60))}:${pad(e % 60)}`
      }
    } else {
      removeUI()
    }
  }
  setInterval(tick, 1000)
  tick()
})()