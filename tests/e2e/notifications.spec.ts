import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("所有角色在 sidebar 都見到訊息通知", async ({ page }) => {
  await page.goto("/");
  for (const role of [
    "文文B MM",
    "開單員",
    "阿花",
    "會計",
    "Super Admin",
  ]) {
    await switchRole(page, role);
    await expect(
      page.getByRole("link", { name: /訊息通知/ }),
    ).toBeVisible();
  }
});

test("訊息通知頁可標記已讀並前往相關單據", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "阿花");
  await page.goto("/orders");
  await page
    .locator(".order-rail-row")
    .filter({ hasText: "D2600001" })
    .click();
  await page.getByRole("button", { name: "工程完成", exact: true }).first().click();
  await switchRole(page, "開單員");
  await page.getByRole("link", { name: /訊息通知/ }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(
    page.getByRole("heading", { name: "訊息通知", exact: true }),
  ).toBeVisible();
  const notice = page
    .locator(".notification-page-row")
    .filter({ hasText: "請收取單據尾數" });
  await expect(notice).toBeVisible();
  await expect(notice.locator(".unread-dot")).toHaveCount(1);
  await notice.click();
  await expect(page).toHaveURL(/\/invoices\/invoice-issued$/);
  await page.goto("/notifications");
  await expect(
    page.locator(".notification-page-row").filter({ hasText: "請收取單據尾數" }),
  ).toHaveCount(1);
  await expect(
    page.locator(".notification-page-row").filter({ hasText: "請收取單據尾數" }).locator(".unread-dot"),
  ).toHaveCount(0);
});
