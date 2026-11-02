/**
 * LeetSync — Background Service Worker
 * - GitHub login via OAuth Device Flow (no client secret, no server needed)
 * - Repo list / create / set by URL
 * - Commit solution + README to GitHub (optional AI commit messages)
 * - Retry queue: failed syncs are kept and retried automatically / manually
 * - Stats, sync log, review alarms, streak reminders
 * - LeetCode login status (session cookie)
 */

import { generateCommitMessage } from './ai.js'
import { registerStreak, checkStreak, markSolvedToday } from './streak.js'

// OAuth App Client ID (public; Device Flow enabled; no secret used)
const GITHUB_CLIENT_ID = 'Ov23liUN57QibncgLKu0'

const store = {
  get: k => chrome.storage.local.get(k),
  set: o => chrome.storage.local.set(o),
  remove: k => chrome.storage.local.remove(k),
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
const iconUrl = () => chrome.runtime.getURL('icons/icon48.png')

// ── GitHub token health ──────────────────────────────────────

async function tokenDied() {
  await store.remove(['ghToken', 'ghUser']) // keeps the chosen repo
  await store.set({ ghError: 'GitHub login expired or was revoked. Please reconnect.' })
  chrome.notifications.create('gh-reconnect', {
    type: 'basic', iconUrl: iconUrl(), priority: 2, requireInteraction: true,
    title: '🔑 LeetSync — reconnect GitHub',
    message: 'Your GitHub login is no longer valid. Open LeetSync → Setup and reconnect. Queued solutions will sync automatically afterwards.',
  })
}

async function verifyGithub() {
  const { ghToken } = await store.get('ghToken')
  if (!ghToken) return
  const r = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${ghToken}`, Accept: 'application/vnd.github+json' },
  })
  if (r.status === 401) await tokenDied()
}

// ── GitHub REST helpers ──────────────────────────────────────

async function gh(path, token, opts = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (r.status === 401) {
      const { ghToken } = await store.get('ghToken')
      if (token && ghToken === token) await tokenDied()
      const err = new Error('GitHub login expired or was revoked. Open LeetSync → Setup and reconnect GitHub.')
      err.status = 401
      throw err
    }
    const err = new Error(data.message || `GitHub error ${r.status}`)
    err.status = r.status
    throw err
  }
  return data
}

const encPath = p => p.split('/').map(encodeURIComponent).join('/')

async function getFileSha(owner, repo, path, branch, token) {
  try {
    const d = await gh(`/repos/${owner}/${repo}/contents/${encPath(path)}?ref=${encodeURIComponent(branch)}`, token)
    return d.sha
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach(b => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

async function commitFile(owner, repo, path, branch, content, message, sha, token) {
  const body = { message, content: toBase64(content), branch }
  if (sha) body.sha = sha
  return gh(`/repos/${owner}/${repo}/contents/${encPath(path)}`, token, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

// ── GitHub Device Flow ───────────────────────────────────────

let polling = false

async function startDeviceFlow() {
  if (GITHUB_CLIENT_ID.startsWith('REPLACE')) {
    return { ok: false, error: 'Set GITHUB_CLIENT_ID in service-worker.js first.' }
  }
  const r = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: 'repo' }),
  })
  const d = await r.json()
  if (!d.device_code) return { ok: false, error: d.error_description || 'Could not start GitHub login' }

  await store.remove('ghError')
  await store.set({ deviceFlow: { ...d, startedAt: Date.now() } })
  chrome.tabs.create({ url: d.verification_uri })
  pollDeviceFlow()
  return { ok: true, user_code: d.user_code, verification_uri: d.verification_uri }
}

async function pollDeviceFlow() {
  if (polling) return
  polling = true
  try {
    while (true) {
      const { deviceFlow } = await store.get('deviceFlow')
      if (!deviceFlow) return
      if (Date.now() > deviceFlow.startedAt + deviceFlow.expires_in * 1000) {
        await store.remove('deviceFlow')
        await store.set({ ghError: 'GitHub code expired. Try connecting again.' })
        return
      }

      await sleep((deviceFlow.interval || 5) * 1000 + 1000)
      chrome.runtime.getPlatformInfo() // keeps the service worker alive while we poll

      const r = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          device_code: deviceFlow.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      })
      const d = await r.json()

      if (d.access_token) {
        const me = await gh('/user', d.access_token)
        // storage.onChanged (below) notices the new token and flushes the retry queue
        await store.set({ ghToken: d.access_token, ghUser: me.login, ghTokenAt: Date.now() })
        await store.remove(['deviceFlow', 'ghError'])
        chrome.notifications.create({
          type: 'basic', iconUrl: iconUrl(),
          title: 'LeetSync', message: `GitHub connected as ${me.login}. Now pick a repo.`,
        })
        return
      }
      if (d.error === 'slow_down') {
        deviceFlow.interval = (d.interval || (deviceFlow.interval || 5) + 5)
        await store.set({ deviceFlow })
      } else if (d.error && d.error !== 'authorization_pending') {
        await store.remove('deviceFlow')
        await store.set({ ghError: d.error_description || d.error })
        return
      }
    }
  } catch (e) {
    await store.remove('deviceFlow')
    await store.set({ ghError: e.message })
  } finally {
    polling = false
  }
}

// ── Sync helpers ─────────────────────────────────────────────

const num = v => parseFloat(String(v || '').replace(/[^\d.]/g, ''))

async function isBetter(p) {
  const key = `best_${p.problemSlug}_${p.language}`
  const best = (await store.get(key))[key]
  if (!best) return true
  const rt = num(p.runtime), mem = num(p.memory)
  return (Number.isFinite(rt) && rt < best.runtime) || (Number.isFinite(mem) && mem < best.memory)
}

async function saveBest(p) {
  const key = `best_${p.problemSlug}_${p.language}`
  const best = (await store.get(key))[key] || { runtime: Infinity, memory: Infinity }
  const rt = num(p.runtime), mem = num(p.memory)
  await store.set({
    [key]: {
      runtime: Number.isFinite(rt) ? Math.min(best.runtime, rt) : best.runtime,
      memory: Number.isFinite(mem) ? Math.min(best.memory, mem) : best.memory,
    },
  })
}

function noteToMarkdown(n) {
  if (!n) return ''
  if (n.content && n.content.trim()) return n.content.trim()
  return [
    ['Core Intuition', n.coreIntuition],
    ['Edge Cases', n.edgeCases],
    ['Time Complexity', n.timeComplexity],
    ['Space Complexity', n.spaceComplexity],
    ['Alternative Approaches', n.alternativeApproaches],
  ]
    .filter(([, v]) => v && v.trim())
    .map(([h, v]) => `### ${h}\n${v.trim()}`)
    .join('\n\n')
}

function buildReadme(p, notes) {
  const idStr = String(p.problemId || 0).padStart(4, '0')
  const badge = p.difficulty === 'Easy' ? '🟢' : p.difficulty === 'Medium' ? '🟡' : '🔴'
  const t = p.timeTaken ? `${Math.floor(p.timeTaken / 60)}m ${p.timeTaken % 60}s` : 'N/A'
  return `# ${idStr}. ${p.problemTitle || 'Problem'}

${badge} **${p.difficulty || 'Unknown'}** &nbsp;|&nbsp; Tags: ${(p.tags || []).map(x => `\`${x}\``).join(' ') || 'N/A'}

> [LeetCode Problem](https://leetcode.com/problems/${p.problemSlug}/)

---

## 📊 Submission Stats

| Metric | Value |
|--------|-------|
| Language | ${p.language || 'N/A'} |
| Runtime | ${p.runtime || 'N/A'} (beats ${p.runtimePercentile || 'N/A'}%) |
| Memory | ${p.memory || 'N/A'} (beats ${p.memoryPercentile || 'N/A'}%) |
| Time Taken | ${t} |

---

## 💡 Notes & Edge Cases

${notes || '*No notes added yet.*'}

---

*Auto-generated by LeetSync*
`
}

function langExt(lang = '') {
  const map = {
    python: 'py', python3: 'py', cpp: 'cpp', java: 'java', javascript: 'js', typescript: 'ts',
    golang: 'go', go: 'go', rust: 'rs', kotlin: 'kt', swift: 'swift', c: 'c', csharp: 'cs',
    ruby: 'rb', scala: 'scala', php: 'php', dart: 'dart', racket: 'rkt', erlang: 'erl',
    elixir: 'ex', bash: 'sh', mysql: 'sql', mssql: 'sql', oraclesql: 'sql', postgresql: 'sql',
  }
  return map[lang.toLowerCase()] || 'txt'
}

// ── Folder templates ─────────────────────────────────────────
// Variables: {id} {slug} {difficulty} {topic} {lang}

const DEFAULT_TEMPLATE = 'LeetCode/{id}-{slug}/'
const KNOWN_VARS = ['id', 'slug', 'difficulty', 'topic', 'lang']

const cleanSegment = v =>
  String(v || '').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').replace(/^\.+/, '')

function buildFolder(template, p) {
  const vars = {
    id: String(p.problemId || 0).padStart(4, '0'),
    slug: cleanSegment(p.problemSlug),
    difficulty: cleanSegment(p.difficulty) || 'Unknown',
    topic: cleanSegment((p.tags || [])[0]) || 'Uncategorized', // first LeetCode topic tag
    lang: cleanSegment(p.language) || 'unknown',
  }
  const filled = (template || DEFAULT_TEMPLATE).replace(/\{(\w+)\}/g, (_m, k) => (k in vars ? vars[k] : ''))
  const parts = filled.split('/').map(s => s.trim()).filter(s => s && s !== '.' && s !== '..')
  return parts.length ? parts.join('/') + '/' : ''
}

function templateWarnings(template) {
  const t = template || DEFAULT_TEMPLATE
  const warnings = []
  const used = [...t.matchAll(/\{(\w+)\}/g)].map(m => m[1])
  const unknown = [...new Set(used.filter(k => !KNOWN_VARS.includes(k)))]
  if (unknown.length) warnings.push(`Unknown variable: ${unknown.map(k => `{${k}}`).join(', ')}`)
  if (!used.includes('slug') && !used.includes('id')) {
    warnings.push('Add {id} or {slug}, otherwise different problems overwrite each other.')
  }
  return warnings
}

const dayKey = d => d.toLocaleDateString('en-CA') // YYYY-MM-DD, local time

async function recordStats(p, { markToday }) {
  const { solved = {}, activeDays = [] } = await store.get(['solved', 'activeDays'])
  if (!solved[p.problemSlug]) solved[p.problemSlug] = { difficulty: p.difficulty, at: Date.now() }
  if (markToday) {
    const k = dayKey(new Date())
    if (!activeDays.includes(k)) activeDays.push(k)
  }
  await store.set({ solved, activeDays: activeDays.slice(-400) })
}

// ── Sync log ─────────────────────────────────────────────────

async function addLog(entry) {
  const { syncLogs = [] } = await store.get('syncLogs')
  syncLogs.unshift({ ...entry, syncedAt: new Date().toISOString() })
  await store.set({ syncLogs: syncLogs.slice(0, 200) })
}

// A newer sync of the same problem+language replaces older failed entries
async function supersedeFailedLogs(qkey) {
  const { syncLogs = [] } = await store.get('syncLogs')
  let changed = false
  for (const l of syncLogs) {
    if (l.qkey === qkey && l.status === 'failed') {
      l.status = 'skipped'
      l.errorMessage = 'Replaced by a newer sync'
      changed = true
    }
  }
  if (changed) await store.set({ syncLogs })
}

// Update the newest failed entry for this problem (used by retries)
async function updateFailedLog(qkey, patch) {
  const { syncLogs = [] } = await store.get('syncLogs')
  const l = syncLogs.find(x => x.qkey === qkey && x.status === 'failed')
  if (!l) return false
  Object.assign(l, patch)
  await store.set({ syncLogs })
  return true
}

// ── Retry queue ──────────────────────────────────────────────

const MAX_AUTO_ATTEMPTS = 6
const MAX_QUEUE = 50
const qkeyOf = p => `${p.problemSlug}_${p.language}`
const inflight = new Set()

async function getQueue() {
  const { retryQueue = {} } = await store.get('retryQueue')
  return retryQueue
}

async function enqueue(p, qkey, message, isRetry) {
  const queue = await getQueue()
  const prev = queue[qkey]
  queue[qkey] = {
    payload: p,
    attempts: isRetry && prev ? prev.attempts + 1 : 1,
    queuedAt: isRetry && prev ? prev.queuedAt : Date.now(),
    lastTriedAt: Date.now(),
    lastError: message,
  }
  const keys = Object.keys(queue)
  if (keys.length > MAX_QUEUE) {
    keys.sort((a, b) => queue[a].queuedAt - queue[b].queuedAt)
      .slice(0, keys.length - MAX_QUEUE)
      .forEach(k => delete queue[k])
  }
  await store.set({ retryQueue: queue })
}

async function dequeue(qkey) {
  const queue = await getQueue()
  if (queue[qkey]) {
    delete queue[qkey]
    await store.set({ retryQueue: queue })
  }
}

async function recordFailure(p, qkey, message, isRetry) {
  await enqueue(p, qkey, message, isRetry)
  if (isRetry) {
    const updated = await updateFailedLog(qkey, { errorMessage: message, syncedAt: new Date().toISOString() })
    if (updated) return
  } else {
    await supersedeFailedLogs(qkey)
  }
  await addLog({
    problemTitle: p.problemTitle, problemSlug: p.problemSlug, difficulty: p.difficulty,
    language: p.language, runtime: p.runtime, commitUrl: '', status: 'failed',
    errorMessage: message, qkey,
  })
}

let flushing = false

/** Retry queued syncs. force=true also retries items that hit the auto-retry limit. */
async function processQueue({ force = false } = {}) {
  if (flushing) return { ok: false, error: 'A retry is already running.' }
  flushing = true
  let done = 0, failed = 0
  try {
    const s = await store.get(['ghToken', 'ghRepo'])
    if (!s.ghToken || !s.ghRepo) {
      return { ok: false, error: 'Connect GitHub and choose a repo first.' }
    }
    const queue = await getQueue()
    for (const [qkey, item] of Object.entries(queue)) {
      if (!force && item.attempts >= MAX_AUTO_ATTEMPTS) continue
      const r = await syncToGithub(item.payload, { retry: true })
      if (r.ok) done++
      else {
        failed++
        if (r.status === 401 || r.notConfigured) break // no point continuing without a valid login
      }
    }
  } finally {
    flushing = false
  }
  if (done > 0 && !force) {
    chrome.notifications.create({
      type: 'basic', iconUrl: iconUrl(),
      title: '✅ LeetSync — queued solutions synced',
      message: `${done} solution${done > 1 ? 's' : ''} that failed earlier ${done > 1 ? 'were' : 'was'} pushed to GitHub.`,
    })
  }
  return { ok: true, done, failed }
}

// ── Sync ─────────────────────────────────────────────────────

async function syncToGithub(p, { retry = false } = {}) {
  const qkey = qkeyOf(p)
  if (inflight.has(qkey)) return { ok: false, error: 'A sync for this problem is already running.' }
  inflight.add(qkey)
  try {
    return await doSync(p, qkey, retry)
  } finally {
    inflight.delete(qkey)
  }
}

async function doSync(p, qkey, retry) {
  const s = await store.get([
    'ghToken', 'ghRepo', 'ghBranch', 'folderTemplate', 'bestSubmissionOnly',
    'aiCommit', 'aiKey', 'aiModel', 'aiFallbackModel',
  ])

  if (!s.ghToken || !s.ghRepo) {
    const error = 'Connect GitHub and choose a repo in the LeetSync popup.'
    if (!retry) {
      await recordFailure(p, qkey, error, false)
      await markSolvedToday().catch(() => {}) // LeetCode accepted it, so today is done
    }
    return { ok: false, error, notConfigured: true }
  }

  if (s.bestSubmissionOnly && !(await isBetter(p))) {
    if (retry) {
      await supersedeFailedLogs(qkey)
      await dequeue(qkey)
    }
    return { ok: true, skipped: true }
  }

  const [owner, repo] = s.ghRepo.split('/')
  const branch = s.ghBranch || 'main'
  const folder = buildFolder(s.folderTemplate, p)

  const solutionPath = `${folder}solution.${langExt(p.language)}`
  const readmePath = `${folder}README.md`
  const commitUrl = `https://github.com/${s.ghRepo}/blob/${branch}/${solutionPath}`

  try {
    const noteKey = `note_${p.problemSlug}`
    const notes = noteToMarkdown((await store.get(noteKey))[noteKey])

    // Commit message: AI-generated if enabled, otherwise (or on any AI failure) the default
    let solMsg = `feat: add ${p.problemTitle} [${p.difficulty}]`
    if (s.aiCommit && s.aiKey) {
      try {
        solMsg = await generateCommitMessage(p, {
          aiKey: s.aiKey, aiModel: s.aiModel, aiFallbackModel: s.aiFallbackModel,
        })
        await store.remove('aiLastError')
      } catch (e) {
        await store.set({ aiLastError: e.message })
      }
    }

    const solSha = await getFileSha(owner, repo, solutionPath, branch, s.ghToken)
    const solRes = await commitFile(owner, repo, solutionPath, branch, p.code, solMsg, solSha, s.ghToken)

    const readSha = await getFileSha(owner, repo, readmePath, branch, s.ghToken)
    await commitFile(owner, repo, readmePath, branch, buildReadme(p, notes),
      `docs: update README for ${p.problemTitle}`, readSha, s.ghToken)

    const entry = {
      problemTitle: p.problemTitle, problemSlug: p.problemSlug, difficulty: p.difficulty,
      language: p.language, runtime: p.runtime, commitUrl, status: 'success', qkey,
      commitSha: (solRes && solRes.commit && solRes.commit.sha) || '',
    }
    if (retry) {
      const updated = await updateFailedLog(qkey, { ...entry, errorMessage: '', syncedAt: new Date().toISOString() })
      if (!updated) await addLog(entry)
    } else {
      await supersedeFailedLogs(qkey)
      await addLog(entry)
    }
    await dequeue(qkey)

    await recordStats(p, { markToday: !retry })
    await saveBest(p)

    if (!retry) {
      await markSolvedToday().catch(() => {})
      chrome.notifications.create({
        type: 'basic', iconUrl: iconUrl(),
        title: '✅ LeetSync — Synced!', message: `${p.problemTitle} pushed to ${s.ghRepo}.`,
      })
      processQueue().catch(() => {}) // GitHub is reachable now: flush anything that failed earlier
    }
    return { ok: true, commitUrl }
  } catch (err) {
    await recordFailure(p, qkey, err.message, retry)
    if (!retry) await markSolvedToday().catch(() => {}) // accepted on LeetCode even though GitHub failed
    return { ok: false, error: err.message, status: err.status }
  }
}

// ── Stats ────────────────────────────────────────────────────

async function getStats() {
  const { syncLogs = [], solved = {}, activeDays = [], streakInfo } =
    await store.get(['syncLogs', 'solved', 'activeDays', 'streakInfo'])
  const ok = syncLogs.filter(l => l.status === 'success')
  const today = new Date().toDateString()
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)

  const counts = { Easy: 0, Medium: 0, Hard: 0 }
  Object.values(solved).forEach(v => { if (counts[v.difficulty] !== undefined) counts[v.difficulty]++ })

  // local streak fallback: consecutive active days ending today (or yesterday)
  const days = new Set(activeDays)
  const cur = new Date()
  if (!days.has(dayKey(cur))) cur.setDate(cur.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cur))) { streak++; cur.setDate(cur.getDate() - 1) }

  return {
    total: Object.keys(solved).length,
    today: ok.filter(l => new Date(l.syncedAt).toDateString() === today).length,
    week: ok.filter(l => new Date(l.syncedAt) >= weekStart).length,
    easy: counts.Easy, medium: counts.Medium, hard: counts.Hard,
    streak: streakInfo ? streakInfo.streak : streak,
    logs: syncLogs.slice(0, 20),
  }
}

// ── Message routing ──────────────────────────────────────────

async function handle(msg) {
  switch (msg.type) {
    case 'SYNC_SUBMISSION':
      return syncToGithub(msg.payload)

    case 'RETRY_SYNC': {
      const item = (await getQueue())[msg.qkey]
      if (!item) {
        return { ok: false, error: 'Nothing to retry for this entry (already synced or replaced by a newer submission).' }
      }
      return syncToGithub(item.payload, { retry: true })
    }

    case 'RETRY_ALL':
      return processQueue({ force: true })

    case 'GET_STATS':
      return getStats()

    case 'LC_USER':
      await store.set({ lcUser: msg.username || '' })
      return { ok: true }

    case 'LC_STATUS': {
      const c = await chrome.cookies.get({ url: 'https://leetcode.com', name: 'LEETCODE_SESSION' })
      const { lcUser = '' } = await store.get('lcUser')
      return { loggedIn: !!c, username: c ? lcUser : '' }
    }

    case 'GH_STATUS': {
      const s = await store.get(['ghToken', 'ghUser', 'ghRepo', 'ghBranch', 'deviceFlow', 'ghError'])
      if (s.deviceFlow && !polling) pollDeviceFlow()
      return {
        connected: !!s.ghToken, user: s.ghUser || '', repo: s.ghRepo || '', branch: s.ghBranch || 'main',
        pending: s.deviceFlow ? { user_code: s.deviceFlow.user_code, verification_uri: s.deviceFlow.verification_uri } : null,
        error: s.ghError || '',
      }
    }

    case 'GH_CONNECT':
      return startDeviceFlow()

    case 'GH_DISCONNECT':
      await store.remove(['ghToken', 'ghUser', 'ghRepo', 'ghBranch', 'deviceFlow', 'ghError'])
      return { ok: true }

    case 'GH_REPOS': {
      const { ghToken } = await store.get('ghToken')
      if (!ghToken) return { repos: [] }
      const list = await gh('/user/repos?per_page=100&sort=pushed&affiliation=owner,collaborator,organization_member', ghToken)
      return {
        repos: list.filter(r => r.permissions && r.permissions.push)
          .map(r => ({ full_name: r.full_name, private: r.private, default_branch: r.default_branch })),
      }
    }

    case 'GH_CREATE_REPO': {
      const { ghToken } = await store.get('ghToken')
      const r = await gh('/user/repos', ghToken, {
        method: 'POST',
        body: JSON.stringify({ name: msg.name, private: true, auto_init: true, description: 'My LeetCode solutions, synced by LeetSync' }),
      })
      await store.set({ ghRepo: r.full_name, ghBranch: r.default_branch })
      return { ok: true, repo: { full_name: r.full_name, private: r.private, default_branch: r.default_branch } }
    }

    case 'GH_SET_REPO': {
      const { ghToken } = await store.get('ghToken')
      const m = String(msg.input || '').trim()
        .match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/.*)?$/i)
      if (!m) return { ok: false, error: 'Enter owner/repo or a github.com URL' }
      const r = await gh(`/repos/${m[1]}/${m[2]}`, ghToken)
      if (!(r.permissions && r.permissions.push)) return { ok: false, error: "You don't have write access to that repo" }
      await store.set({ ghRepo: r.full_name, ghBranch: r.default_branch })
      return { ok: true, repo: { full_name: r.full_name, private: r.private, default_branch: r.default_branch } }
    }

    case 'AI_TEST': {
      const s = await store.get(['aiKey', 'aiModel', 'aiFallbackModel'])
      if (!s.aiKey) return { ok: false, error: 'Add your Gemini API key first.' }
      const t = Date.now()
      try {
        const message = await generateCommitMessage({
          problemTitle: 'Two Sum', difficulty: 'Easy', language: 'python3',
          runtime: '52 ms', memory: '17 MB',
          code: 'class Solution:\n    def twoSum(self, nums, target):\n        seen = {}\n        for i, n in enumerate(nums):\n            if target - n in seen:\n                return [seen[target - n], i]\n            seen[n] = i\n',
        }, { aiKey: s.aiKey, aiModel: s.aiModel, aiFallbackModel: s.aiFallbackModel })
        return { ok: true, message, ms: Date.now() - t }
      } catch (e) {
        return { ok: false, error: e.message, ms: Date.now() - t }
      }
    }

    case 'FOLDER_PREVIEW': {
      const sample = {
        problemId: 1, problemSlug: 'two-sum', difficulty: 'Easy',
        tags: ['Array', 'Hash Table'], language: 'python3',
      }
      return {
        path: buildFolder(msg.template, sample) + 'solution.py',
        warnings: templateWarnings(msg.template),
      }
    }

    case 'STREAK_CHECK':
      return checkStreak(msg.test ? 'test' : 'manual')

    case 'OPEN_NOTES':
      try { await chrome.action.openPopup() } catch (_) {}
      return { ok: true }

    default:
      return { ok: false, error: 'Unknown message' }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handle(msg).then(sendResponse).catch(e => sendResponse({ ok: false, error: e.message }))
  return true // async response
})

// ── Review reminders ─────────────────────────────────────────

chrome.alarms.onAlarm.addListener(alarm => {
  if (!alarm.name.startsWith('review_')) return
  const slug = alarm.name.replace('review_', '')
  chrome.notifications.create({
    type: 'basic', iconUrl: iconUrl(),
    title: '📚 LeetSync — Time to Review!',
    message: `Spaced repetition: revisit "${slug.replace(/-/g, ' ')}" today.`,
  })
})

// ── Startup wiring ───────────────────────────────────────────

// Resume an interrupted GitHub login if the worker was restarted
store.get('deviceFlow').then(({ deviceFlow }) => { if (deviceFlow) pollDeviceFlow() })

registerStreak()

// Verify the GitHub token (only a 401 counts as "dead", so offline is harmless)
chrome.runtime.onStartup.addListener(() => verifyGithub().catch(() => {}))
chrome.alarms.get('gh_verify').then(a => { if (!a) chrome.alarms.create('gh_verify', { periodInMinutes: 360 }) })
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'gh_verify') verifyGithub().catch(() => {}) })
chrome.notifications.onClicked.addListener(id => {
  if (id !== 'gh-reconnect') return
  chrome.action.openPopup().catch(() => {})
  chrome.notifications.clear(id)
})

// Retry queue: on browser start, every 15 min, and whenever a GitHub token / repo gets set
chrome.runtime.onStartup.addListener(() => processQueue().catch(() => {}))
chrome.alarms.get('retry_queue').then(a => { if (!a) chrome.alarms.create('retry_queue', { periodInMinutes: 15 }) })
chrome.alarms.onAlarm.addListener(a => { if (a.name === 'retry_queue') processQueue().catch(() => {}) })
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if ((changes.ghToken && changes.ghToken.newValue) || (changes.ghRepo && changes.ghRepo.newValue)) {
    processQueue().catch(() => {})
  }
})