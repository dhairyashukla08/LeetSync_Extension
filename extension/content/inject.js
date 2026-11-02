/**
 * LeetSync — page-world script (runs in the page's own JS context, "world": "MAIN").
 * A normal content script lives in an isolated world, so patching fetch there never
 * sees LeetCode's own requests. This file only watches the "submission check" polling
 * endpoint and tells the content script when a submission was Accepted.
 */
;(function () {
    const CHECK_RE = /\/submissions\/detail\/(\d+)\/(?:v2\/)?check\/?/

  function report(url, data) {
    const m = CHECK_RE.exec(url)
    if (!m || !data) return
    // Only react once the judge has finished (not while still pending)
    const done = data.state ? data.state === 'SUCCESS' : !!data.status_msg
    if (!done) return
    window.postMessage(
      { source: 'leetsync', type: 'SUBMISSION_ACCEPTED', submissionId: m[1] },
      window.location.origin
    )
  }

  // fetch
  const origFetch = window.fetch
  window.fetch = function (...args) {
    const p = origFetch.apply(this, args)
    try {
      const req = args[0]
      const url = typeof req === 'string' ? req : req && req.url ? req.url : String(req)
      if (CHECK_RE.test(url)) {
        p.then(r => r.clone().json()).then(d => report(url, d)).catch(() => {})
      }
    } catch (_) {}
    return p
  }

  // XMLHttpRequest (in case LeetCode uses it for polling)
  const origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      const u = String(url)
      if (CHECK_RE.test(u)) {
        this.addEventListener('load', () => {
          try { report(u, JSON.parse(this.responseText)) } catch (_) {}
        })
      }
    } catch (_) {}
    return origOpen.call(this, method, url, ...rest)
  }
})()