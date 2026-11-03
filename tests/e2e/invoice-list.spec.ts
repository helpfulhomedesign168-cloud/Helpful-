import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("單據管理顯示收款status bar並可按Invoice／Sales／工程狀態排序", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "開單員");
  await page.goto("/invoices");
  await expect(
    page.getByPlaceholder("搜尋工程名稱或代號"),
  ).toBeVisible();
  const statusFilter = page.getByLabel("Invoice狀態", { exact: true });
  const teamFilter = page.getByLabel("Invoice Team", { exact: true });
  const salesFilter = page.getByLabel("Invoice Sales", { exact: true });
  await expect(statusFilter).toBeVisible();
  await expect(teamFilter).toBeVisible();
  await expect(salesFilter).toBeVisible();
  await expect(
    page.locator(".invoice-legend .normal-dot"),
  ).toHaveText("正單");
  await expect(
    page.locator(".invoice-legend .additional-dot"),
  ).toHaveText("加單");
  await expect(
    page.getByRole("button", { name: /查看／修改 SHMM/ }),
  ).toHaveCount(0);
  const progress = page.locator(".payment-progress-track").first();
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", /^[0-9.]+$/);

  const invoiceSort = page.getByRole("button", { name: /Invoice單/ });
  const salesSort = page.getByRole("button", { name: /^Sales/ });
  const statusSort = page.getByRole("button", { name: /^狀態/ });
  await invoiceSort.click();
  await expect(invoiceSort).toHaveClass(/active/);
  await salesSort.click();
  await expect(salesSort).toHaveClass(/active/);
  await statusSort.click();
  await expect(statusSort).toHaveClass(/active/);
  await expect(
    page.getByRole("button", { name: "已完成工程", exact: true }),
  ).toHaveCount(0);
});

test("CS可標記工程完成，Invoice列表顯示工程完成並通知開單員收尾數", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "阿花");
  await page.goto("/orders");
  const railRow = page.locator(".order-rail-row").filter({ hasText: "D2600001" });
  await expect(railRow).toBeVisible();
  await railRow.click();
  await page.getByRole("button", { name: "工程完成", exact: true }).first().click();
  await expect(page.getByText("工程完成", { exact: true })).toBeVisible();

  await switchRole(page, "開單員");
  await page.goto("/invoices");
  const invoiceRow = page
    .locator("tbody tr")
    .filter({ hasText: "SHMM26100001" });
  await expect(invoiceRow).toContainText("已完成工程");

  await page.getByRole("button", { name: "通知" }).click();
  const notice = page
    .locator(".notification-row")
    .filter({ hasText: "請收取單據尾數" });
  await expect(notice).toBeVisible();
  await notice.click();
  await expect(page).toHaveURL(/\/invoices\/invoice-issued$/);
});
