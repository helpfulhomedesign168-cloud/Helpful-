export const ROLES = [
  "invoice_clerk",
  "finance",
  "finance_supervisor",
  "cs",
  "cs_supervisor",
  "admin",
  "admin_staff",
  "sales",
  "supervisor",
  "head",
  "clerk",
] as const;

export type Role = (typeof ROLES)[number];

export const HIDDEN_ROLES: Role[] = ["sales", "supervisor", "head", "clerk"];
