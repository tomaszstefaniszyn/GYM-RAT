export async function onRequestError(
  error: unknown,
  request: Readonly<{ path: string; method: string }>,
  context: Readonly<{ routePath: string; routeType: string; routerKind: string }>,
) {
  console.error('[gym-rat] błąd', context.routerKind, context.routeType, context.routePath, request.method, request.path, error)
}
