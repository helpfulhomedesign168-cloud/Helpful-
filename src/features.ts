// Production/default is hidden. Set localStorage to "1" to reveal the
// legacy Sales workspace for development or a future rollout.
export const SALES_WORKSPACE_ENABLED =
  localStorage.getItem("homeflow-sales-workspace") === "1";

// Keep the old clerk workflow available for historical data and future
// reactivation, but hide it while the direct-invoice role is in use.
export const LEGACY_CLERK_ENABLED =
  localStorage.getItem("homeflow-legacy-clerk") === "1";

export const SALES_ROLES = ["sales", "supervisor", "head"] as const;

export function isSalesRole(role: string) {
  return (SALES_ROLES as readonly string[]).includes(role);
}

export function isRoleVisible(role: string) {
  if (isSalesRole(role)) return SALES_WORKSPACE_ENABLED;
  if (role === "clerk") return LEGACY_CLERK_ENABLED;
  return true;
}
