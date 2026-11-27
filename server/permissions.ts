import type { Role } from "./roles";

export const CAPABILITIES = [
  "customer.read",
  "customer.write",
  "invoice.read",
  "invoice.create",
  "invoice.amend",
  "payment.register",
  "payment.validate",
  "receipt.issue",
  "workorder.read",
  "workorder.assign",
  "workorder.update",
  "workorder.complete",
  "contractor.manage",
  "municipal.read",
  "municipal.write",
  "refund.manage",
  "user.manage",
  "feature_flags.manage",
  "audit.read",
  "report.read",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const baseClerk: Capability[] = [
  "customer.read",
  "customer.write",
  "invoice.read",
  "invoice.create",
  "invoice.amend",
  "payment.register",
  "payment.validate",
  "receipt.issue",
  "workorder.read",
  "municipal.read",
  "municipal.write",
];

const finance: Capability[] = [
  "customer.read",
  "invoice.read",
  "payment.validate",
  "workorder.read",
  "municipal.read",
  "refund.manage",
  "report.read",
];

const financeSupervisor: Capability[] = [
  ...finance,
  "audit.read",
];

const cs: Capability[] = [
  "customer.read",
  "workorder.read",
  "workorder.update",
  "workorder.complete",
  "contractor.manage",
];

const csSupervisor: Capability[] = [
  ...cs,
  "workorder.assign",
  "contractor.manage",
];

const admin: Capability[] = [...CAPABILITIES];

const adminStaff: Capability[] = CAPABILITIES.filter(
  (capability) =>
    capability !== "user.manage" &&
    capability !== "feature_flags.manage",
);

export const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  invoice_clerk: baseClerk,
  finance,
  finance_supervisor: financeSupervisor,
  cs,
  cs_supervisor: csSupervisor,
  admin,
  admin_staff: adminStaff,
  sales: [],
  supervisor: [],
  head: [],
  clerk: [],
};

export function hasCapability(role: Role, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}
