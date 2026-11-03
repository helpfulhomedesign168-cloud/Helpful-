import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Super Admin可新增、修改、停用及啟用用戶", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "SuperAdmin");
  await page
    .locator("nav")
    .getByRole("link", { name: "用戶管理", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "用戶管理", exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "新增用戶", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "新增用戶" });
  await addDialog.getByLabel("用戶姓名").fill("E2E 測試銷售");
  await addDialog.getByLabel("員工Code").fill("ET");
  await addDialog.getByLabel("用戶角色").selectOption("sales");
  await addDialog.getByLabel("用戶Team").selectOption("A");
  await addDialog.getByRole("button", { name: "新增用戶", exact: true }).click();

  const row = page.locator(".user-table tbody tr").filter({ hasText: "E2E 測試銷售" });
  await expect(row).toContainText("啟用中");
  await expect(row).toContainText("Team A");

  await page.locator(".actor-button").click();
  await expect(
    page.locator(".role-option").filter({ hasText: "E2E 測試銷售" }),
  ).toHaveCount(1);
  await page.keyboard.press("Escape");

  await row.getByRole("button", { name: "修改E2E 測試銷售" }).click();
  const editDialog = page.getByRole("dialog", { name: "修改用戶" });
  await expect(editDialog.getByLabel("員工Code")).toBeDisabled();
  await editDialog.getByLabel("用戶姓名").fill("E2E 測試主管");
  await editDialog.getByLabel("用戶角色").selectOption("supervisor");
  await editDialog.getByRole("button", { name: "儲存修改", exact: true }).click();
  await expect(
    page.locator(".user-table tbody tr").filter({ hasText: "E2E 測試主管" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "停用E2E 測試主管", exact: true })
    .click();
  await expect(
    page.locator(".user-table tbody tr").filter({ hasText: "E2E 測試主管" }),
  ).toContainText("已停用");
  await page.locator(".actor-button").click();
  await expect(
    page.locator(".role-option").filter({ hasText: "E2E 測試主管" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", { name: "啟用E2E 測試主管", exact: true })
    .click();
  await expect(
    page.locator(".user-table tbody tr").filter({ hasText: "E2E 測試主管" }),
  ).toContainText("啟用中");
});
