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

test("用戶管理預覽在mobile用hamburger drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "SuperAdmin" }).first().click();
  await page.goto("/design/users");
  const toggle = page.getByRole("button", { name: "開啟選單" });
  await expect(toggle).toBeVisible();
  await expect(page.locator(".preview-brand")).toBeHidden();
  await toggle.click();
  await expect(page.locator("#preview-sidebar")).toHaveClass(/open/);
  await expect(page.locator(".preview-drawer-close")).toBeVisible();
  await page.locator(".preview-drawer-close").click();
  await expect(page.locator("#preview-sidebar")).not.toHaveClass(/open/);
});


test("工程單設計預覽顯示filters、類別及pager", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "SuperAdmin" }).first().click();
  await page.goto("/design/orders");
  await expect(
    page.getByRole("heading", { name: "工程單", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("跟進同事")).toBeVisible();
  await expect(page.getByLabel("工程單月份")).toBeVisible();
  await expect(page.getByLabel("工程單Sales")).toBeVisible();
  await expect(page.locator(".preview-orders-table thead")).toContainText(
    "跟進同事",
  );
  await expect(page.locator(".preview-category").first()).toBeVisible();
  await expect(
    page.locator(".preview-category").filter({ hasText: "團購" }).first(),
  ).toBeVisible();
  await expect(
    page.locator(".preview-category").filter({ hasText: "8萬" }).first(),
  ).toBeVisible();
  await expect(page.locator(".preview-category-group").nth(2)).toContainText(
    "自費",
  );
  await expect(page.locator(".preview-orders-pager")).toContainText("第 1 /");
  await page.getByRole("button", { name: "下一頁" }).click();
  await expect(page.locator(".preview-orders-pager")).toContainText("第 2 /");
});
