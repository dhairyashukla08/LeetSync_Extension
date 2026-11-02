import React from 'react'

const tiles = [
  { span: 4, title: 'Syncs the moment you pass', text: 'LeetSync waits for Accepted, reads your code, runtime and memory from LeetCode, and commits the solution plus a README to your repo.',
    code: '✓ Accepted · Add Binary\n→ LeetCode/0067-add-binary/solution.py\n→ LeetCode/0067-add-binary/README.md' },
  { span: 2, title: 'Connect with a code', text: 'Log in to GitHub with a short device code. No tokens to copy, and you pick or create the repo.',
    code: 'Enter this code on GitHub:\nABCD-1234' },
  { span: 2, title: 'AI commit messages', text: 'Optional. Bring your own Gemini key and each commit describes the approach. If the AI fails, the normal message is used.',
    code: 'feat(array): iterate backwards\nto handle carry' },
  { span: 2, title: 'Your folder structure', text: 'Organise by id, difficulty, topic or language with simple variables, and preview the path before you save.',
    code: 'LeetCode/{difficulty}/\n  {topic}/{id}-{slug}/' },
  { span: 2, title: 'Nothing gets lost', text: 'If GitHub is down or your login expires, the solution is queued and retried automatically. Retry by hand from the log.',
    code: '⟳ Retry all (2 waiting)' },
  { span: 3, title: 'Streak reminders', text: 'Open your browser on a day you have not solved anything and you get a warning, with the time left before LeetCode resets. It reads your real LeetCode calendar.',
    code: '🔥 499-day streak at risk!\nNothing solved today · 5h 20m left' },
  { span: 3, title: 'Notes, timer and review', text: 'Write intuition and edge cases per problem and they land in the README. A timer starts on each problem, and review reminders come back at 3, 7 or 30 days. "Best submission only" keeps one file per problem and language.' },
]

export default function Features() {
  return (
    <section className="ls-sec" id="features">
      <div className="ls-wrap">
        <div className="reveal">
          <div className="ls-eyebrow">01 / Features</div>
          <h2 className="ls-h2">Built around how you actually practise.</h2>
          <p className="ls-sub">Everything runs in your browser. Nothing to host, no account to create.</p>
        </div>
        <div className="ls-bento reveal">
          {tiles.map(t => (
            <div key={t.title} className={`ls-card ls-s${t.span}`}>
              <h3>{t.title}</h3>
              <p>{t.text}</p>
              {t.code && <div className="ls-pre ls-mono">{t.code}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}