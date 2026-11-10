import { expect, test } from "@playwright/test";

test("SuperAdmin可開啟新用戶管理設計預覽", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "SuperAdmin" }).first().click();
  await page
    .locator("nav")
    .getByRole("link", { name: "用戶管理", exact: true })
    .click();
  await page.getByRole("link", { name: "預覽新設計", exact: true }).click();
  await expect(page).toHaveURL(/\/design\/users$/);
  await expect(
    page.getByRole("heading", { name: "用戶管理", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Sales", exact: true })).toBeVisible();
  await expect(page.locator(".preview-table thead")).toContainText("用戶姓名");
  await expect(page.locator(".preview-table tbody tr").first()).toBeVisible();
  await page.getByRole("tab", { name: "工程部", exact: true }).click();
  await expect(page.locator(".preview-table tbody tr").first()).toBeVisible();
});
