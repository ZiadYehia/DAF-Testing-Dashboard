// One automatic retry for transient failures (dev HMR teardown, DB pool reconnect).
export async function fetchWithRetry(url: string): Promise<Response> {
  try {
    const res = await fetch(url)
    if (res.status < 500) return res
  } catch { /* network error — retry below */ }
  await new Promise((r) => setTimeout(r, 700))
  return fetch(url)
}
