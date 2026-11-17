import type { Notification } from "./domain/types";

export function notificationTarget(
  role: string,
  notification: Notification,
): string {
  if (role === "cs" || role === "cs_supervisor") {
    return notification.customRequestId
      ? "/custom-work-requests"
      : "/handoff";
  }
  if (role === "finance") {
    return notification.cancellationCaseId
      ? "/cancellation-cases/" + notification.cancellationCaseId
      : "/finance";
  }
  if (role === "clerk" || role === "finance_supervisor") {
    if (notification.cancellationCaseId)
      return "/cancellation-cases/" + notification.cancellationCaseId;
    if (notification.invoiceId)
      return "/invoices/" + notification.invoiceId;
    return "/submissions";
  }
  return notification.customRequestId
    ? "/quotes/" + notification.quoteId + "/edit"
    : "/quotes/" + notification.quoteId;
}
