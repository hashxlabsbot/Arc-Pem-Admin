/** Internal staff roles manageable from /admin/team, as opposed to customer 'USER' accounts. */
export const TEAM_ROLES = ['ADMIN', 'BLOG_EDITOR'] as const
export type TeamRole = (typeof TEAM_ROLES)[number]

export function isTeamRole(role: unknown): role is TeamRole {
  return role === 'ADMIN' || role === 'BLOG_EDITOR'
}

/** ADMIN and BLOG_EDITOR can read/write blog content; everything else is ADMIN-only. */
export function canManageBlog(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'BLOG_EDITOR'
}
