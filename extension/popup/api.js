// Small promise wrapper around chrome.runtime.sendMessage (safe outside the extension too)
export const send = (type, data = {}) =>
  new Promise(resolve => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return resolve({})
    chrome.runtime.sendMessage({ type, ...data }, r => resolve(r || {}))
  })