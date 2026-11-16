import 'server-only'

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function readBody<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

export function rejectCrossSite(req: Request) {
  const origin = req.headers.get('origin')
  if (!origin) return null
  const hostHeader = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (!hostHeader) return null
  try {
    if (new URL(origin).host !== hostHeader.split(',')[0]!.trim()) {
      return json({ error: 'Niedozwolone źródło.' }, 403)
    }
  } catch {
    return json({ error: 'Niedozwolone źródło.' }, 403)
  }
  return null
}
