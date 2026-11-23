// Production/default is hidden. Set localStorage to "1" to reveal the
// legacy Sales workspace for development or a future rollout.
export const SALES_WORKSPACE_ENABLED =
  localStorage.getItem("homeflow-sales-workspace") === "1";

export const SALES_ROLES = ["sales", "supervisor", "head"] as const;

export function isSalesRole(role: string) {
  return (SALES_ROLES as readonly string[]).includes(role);
}

export function isRoleVisible(role: string) {
  return SALES_WORKSPACE_ENABLED || !isSalesRole(role);
}
