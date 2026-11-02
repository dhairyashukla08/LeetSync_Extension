import React from 'react'

const perms = [
  ['leetcode.com', 'Reads your own submission (code, runtime, memory) after you pass.'],
  ['github.com / api.github.com', 'Logs you in and commits to the repo you choose.'],
  ['cookies', 'Only checks that you are logged in to LeetCode. Your password is never seen.'],
  ['generativelanguage.googleapis.com', 'Only if you turn on AI commit messages. Your code is sent to Google for that one call.'],
  ['storage, alarms, notifications', 'Settings, the retry queue, and reminders.'],
]
const faq = [
  ['Where is my GitHub login stored?', 'In your browser\'s extension storage, on your computer. There is no LeetSync server.'],
  ['Does it work with private repos?', 'Yes. New repos it creates are private by default.'],
  ['What if a sync fails?', 'The solution is saved and retried automatically. You get a notification if you need to reconnect GitHub.'],
  ['Does the AI see my code?', 'Only when you enable it with your own key, and only for the commit message. Leave it off and nothing leaves your browser except the commit.'],
  ['Which browsers work?', 'Chrome and other Chromium browsers such as Brave and Edge.'],
]

export default function Trust() {
  return (
    <section className="ls-sec" id="trust" style={{ paddingTop: 0 }}>
      <div className="ls-wrap ls-two reveal">
        <div>
          <div className="ls-eyebrow">04 / Privacy</div>
          <h2 className="ls-h2">What it can touch, and why.</h2>
          <ul className="ls-list">
            {perms.map(([k, v]) => <li key={k}><code>{k}</code><br />{v}</li>)}
          </ul>
        </div>
        <div>
          <div className="ls-eyebrow">FAQ</div>
          <div className="ls-faq">
            {faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </div>
      </div>
    </section>
  )
}