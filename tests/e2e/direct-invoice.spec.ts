import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("直接開單員可以建立 Invoice，不需要報價單", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "直接開單員");
  await expect(page).toHaveURL(/\/direct-invoices$/);
  await expect(
    page.getByRole("heading", { name: "直接開 Invoice", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "新增 Invoice", exact: true }).first().click();
  await page.getByLabel("客戶姓名", { exact: true }).fill("直開測試客戶");
  await page.getByLabel("聯絡電話", { exact: true }).fill("91234567");
  await page.getByLabel("工程地址", { exact: true }).fill("九龍測試地址 1 號");
  await page.getByLabel("第1項工程", { exact: true }).fill("石屎剷落");
  await page.getByLabel("第1項數量", { exact: true }).fill("1");
  await page.getByLabel("第1項單位", { exact: true }).fill("項");
  await page.getByLabel("第1項金額", { exact: true }).fill("21000");
  await page.getByRole("button", { name: "建立 Invoice", exact: true }).click();
  await expect(page).toHaveURL(/\/invoices\//);
  await expect(page.getByText("直開測試客戶", { exact: false })).toBeVisible();
  await expect(page.getByText(/DINV/).first()).toBeVisible();
  await expect(page.getByText("HK$21,000.00").first()).toBeVisible();
});
