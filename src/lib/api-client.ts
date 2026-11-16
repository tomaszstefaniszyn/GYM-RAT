export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    const headers = new Headers(init?.headers)
    if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    res = await fetch(url, { ...init, headers, cache: 'no-store' })
  } catch {
    throw new Error('Brak połączenia.')
  }

  const text = await res.text()
  let data: { error?: string } | null = null
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string }
    } catch {
      data = null
    }
  }

  const isLogin = url.startsWith('/api/trainer/login')
  if (typeof window !== 'undefined' && res.status === 401 && url.startsWith('/api/trainer') && !isLogin) {
    window.location.href = '/trener'
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error || 'Coś poszło nie tak.')
  }
  return data as T
}
