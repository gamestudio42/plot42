/** Lobby URL: sibling folder on the static site, local lobby port in development. */
export function lobbyHref(): string {
  return import.meta.env.DEV ? 'http://localhost:5176/' : '../';
}
