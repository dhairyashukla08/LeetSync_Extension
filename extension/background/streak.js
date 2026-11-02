/**
 * LeetSync — Streak reminders
 * - Runs when the browser starts, when the extension is (re)loaded, and every 30 min
 * - Reads the user's real LeetCode submission calendar (public data, by username)
 *   and falls back to the days LeetSync itself has synced
 * - If nothing was solved today: toolbar badge "!" + a notification
 *   (on browser start, then again at 6h / 3h / 1h before LeetCode's daily reset)
 *
 * LeetCode's day rolls over at 00:00 UTC.
 */

const store = {
  get: k => chrome.storage.local.get(k),
  set: o => chrome.storage.local.set(o),
}
const iconUrl = () => chrome.runtime.getURL('icons/icon48.png')
const DAY = 86400
const NOTIF_ID = 'streak-reminder'

const utcDayStart = (ms = Date.now()) => Math.floor(ms / 1000 / DAY) * DAY

// ── Data sources ─────────────────────────────────────────────

async function fetchCalendar(username, year) {
  const r = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query userCal($username: String!, $year: Int) {
        matchedUser(username: $username) { userCalendar(year: $year) { submissionCalendar } }
      }`,
      variables: { username, year },
    }),
  })
  if (!r.ok) throw new Error('LeetCode ' + r.status)
  const j = await r.json()
  const raw = j && j.data && j.data.matchedUser && j.data.matchedUser.userCalendar
    ? j.data.matchedUser.userCalendar.submissionCalendar
    : null
  if (!raw) throw new Error('No calendar data')
  return JSON.parse(raw) // { "<utc-midnight-epoch-seconds>": count }
}

function streakFromCalendar(cal) {
  const today = utcDayStart()
  const has = d => (cal[String(d)] || 0) > 0
  const solvedToday = has(today)
  let d = solvedToday ? today : today - DAY
  let streak = 0
  while (has(d)) { streak++; d -= DAY }
  return { streak, solvedToday, deadline: today + DAY }
}

const localKey = d => d.toLocaleDateString('en-CA')

function streakFromLocal(activeDays) {
  const days = new Set(activeDays)
  const cur = new Date()
  const solvedToday = days.has(localKey(cur))
  if (!solvedToday) cur.setDate(cur.getDate() - 1)
  let streak = 0
  while (days.has(localKey(cur))) { streak++; cur.setDate(cur.getDate() - 1) }
  const midnight = new Date()
  midnight.setHours(24, 0, 0, 0)
  return { streak, solvedToday, deadline: midnight.getTime() / 1000 }
}

// ── UI: badge + notification ─────────────────────────────────

async function updateBadge(info, enabled) {
  if (!enabled || info.solvedToday) {
    await chrome.action.setBadgeText({ text: '' })
  } else {
    await chrome.action.setBadgeText({ text: '!' })
    await chrome.action.setBadgeBackgroundColor({ color: '#ff4444' })
  }
}

function fmtLeft(hours) {
  const m = Math.max(0, Math.round(hours * 60))
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

async function maybeNotify(info, reason, reminded) {
  const day = new Date().toISOString().slice(0, 10)
  const state = reminded && reminded.day === day ? reminded : { day, levels: [] }
  const level = info.hoursLeft <= 1 ? 1 : info.hoursLeft <= 3 ? 3 : info.hoursLeft <= 6 ? 6 : 24
  const test = reason === 'test'

  if (!test) {
    if (info.solvedToday) return
    const due = reason === 'startup' || (level <= 6 && !state.levels.includes(level))
    if (!due) return
  }
  if (!state.levels.includes(level)) state.levels.push(level)
  await store.set({ streakReminded: state })

  const left = fmtLeft(info.hoursLeft)
  const resetAt = new Date(info.deadline * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const note = info.source === 'local' ? ' (counted from LeetSync syncs only)' : ''

  let title, message
  if (info.solvedToday) {
    title = "✅ LeetSync — you're safe today"
    message = `${info.streak}-day streak. Next reset at ${resetAt}.${note}`
  } else if (info.streak > 0) {
    title = `🔥 ${info.streak}-day streak at risk!`
    message = `Nothing solved today yet. ${left} left (resets at ${resetAt}).${note}`
  } else {
    title = '📚 LeetSync — solve one today'
    message = `No problem solved today yet. ${left} left (resets at ${resetAt}).${note}`
  }

  chrome.notifications.create(NOTIF_ID, {
    type: 'basic', iconUrl: iconUrl(), title, message, priority: 2, requireInteraction: true,
  })
}

// ── Public API ───────────────────────────────────────────────

/** reason: 'startup' | 'alarm' | 'manual' | 'test' */
export async function checkStreak(reason = 'alarm') {
  const s = await store.get(['streakRemind', 'lcUser', 'activeDays', 'streakReminded'])
  const enabled = s.streakRemind !== false

  let base, source
  try {
    if (!s.lcUser) throw new Error('LeetCode username not known yet')
    const y = new Date().getUTCFullYear()
    const [cur, prev] = await Promise.all([
      fetchCalendar(s.lcUser, y),
      fetchCalendar(s.lcUser, y - 1).catch(() => ({})),
    ])
    base = streakFromCalendar({ ...prev, ...cur })
    source = 'leetcode'
  } catch (_) {
    base = streakFromLocal(s.activeDays || [])
    source = 'local'
  }

  const info = {
    ...base,
    source,
    hoursLeft: (base.deadline * 1000 - Date.now()) / 3.6e6,
    checkedAt: Date.now(),
  }
  await store.set({ streakInfo: info })
  await updateBadge(info, enabled)
  if (enabled) await maybeNotify(info, reason, s.streakReminded)
  return info
}

/** Call right after a successful sync so the badge clears immediately. */
export async function markSolvedToday() {
  const { streakInfo } = await store.get('streakInfo')
  if (streakInfo && !streakInfo.solvedToday) {
    await store.set({ streakInfo: { ...streakInfo, solvedToday: true, streak: streakInfo.streak + 1 } })
  }
  await chrome.action.setBadgeText({ text: '' })
  chrome.notifications.clear(NOTIF_ID)
}

async function ensureAlarm() {
  const a = await chrome.alarms.get('streak_check')
  if (!a) chrome.alarms.create('streak_check', { periodInMinutes: 30 })
}

/** Register listeners — must be called synchronously at the top level of the service worker. */
export function registerStreak() {
  chrome.runtime.onStartup.addListener(() => { ensureAlarm(); checkStreak('startup') })
  chrome.runtime.onInstalled.addListener(() => { ensureAlarm(); checkStreak('startup') })
  chrome.alarms.onAlarm.addListener(a => { if (a.name === 'streak_check') checkStreak('alarm') })
  chrome.notifications.onClicked.addListener(id => {
    if (id !== NOTIF_ID) return
    chrome.tabs.create({ url: 'https://leetcode.com/problemset/' })
    chrome.notifications.clear(id)
  })
  ensureAlarm()
}