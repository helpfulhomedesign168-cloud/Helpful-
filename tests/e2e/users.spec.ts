import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Super Admin可用部門tabs及profile管理用戶", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "SuperAdmin");
  await page
    .locator("nav")
    .getByRole("link", { name: "用戶管理", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "用戶管理", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab")).toHaveCount(4);
  const headers = await page.locator(".user-list-table thead th").allTextContents();
  expect(headers.slice(0, 4)).toEqual(["姓名", "部門", "聯絡電話", "Email"]);
  expect(headers).not.toContain("Code");
  expect(headers).not.toContain("Team");

  await page.getByRole("link", { name: "新增用戶", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立用戶檔案" }),
  ).toBeVisible();
  await page.getByLabel("用戶姓名").fill("E2E 測試銷售");
  await page.getByLabel("用戶姓氏").fill("陳");
  await page.getByLabel("用戶稱呼").fill("E2E");
  await page.getByLabel("用戶聯絡電話").fill("91234567");
  await page.getByLabel("用戶Email").fill("e2e@example.com");
  await page.getByLabel("員工Code").fill("ET");
  await page.getByLabel("登入用戶名").fill("e2e.sales");
  await page.getByLabel("登入密碼").fill("demo1234");
  await page.getByLabel("用戶角色").selectOption("sales");
  await page.getByLabel("用戶Team").selectOption("A");
  await page.getByRole("button", { name: "建立用戶", exact: true }).click();
  await expect(page).toHaveURL(/\/users\/actor-/);
  await expect(
    page.getByRole("heading", {
      name: "E2E 測試銷售",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "返回用戶管理" }).click();
  const row = page.locator(".user-list-table tbody tr").filter({ hasText: "E2E 測試銷售" });
  await expect(row).toContainText("Sales");
  await expect(row).toContainText("91234567");
  await expect(row).toContainText("e2e@example.com");

  await page.locator(".actor-button").click();
  await expect(
    page.locator(".role-option").filter({ hasText: "E2E 測試銷售" }),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");

  await row.getByRole("link", { name: "查看" }).click();
  await page.getByLabel("用戶姓名").fill("E2E 測試主管");
  await page.getByLabel("用戶角色").selectOption("supervisor");
  await page.getByLabel("用戶Team").selectOption("A");
  await page.getByRole("button", { name: "儲存修改", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "E2E 測試主管",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();

  await page.getByRole("button", { name: "停用帳戶", exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(
    page.locator(".user-list-table tbody tr").filter({ hasText: "E2E 測試主管" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /已停用帳戶/ }).click();
  await page
    .getByRole("dialog", { name: "已停用帳戶" })
    .getByRole("link", { name: /E2E 測試主管/ })
    .click();
  await expect(
    page.locator(".user-profile-status").getByText("已停用", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "重新啟用帳戶", exact: true }).click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(
    page.locator(".user-list-table tbody tr").filter({ hasText: "E2E 測試主管" }),
  ).toBeVisible();
});
