import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Super Admin可依供應商分類建立產品款式系列及圖片", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "SuperAdmin");
  await page.getByRole("link", { name: "產品款式", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "產品款式", exact: true }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "PD門", exact: true }).click();
  await expect(page.locator(".product-supplier-card")).toHaveCount(3);
  await page
    .locator(".product-supplier-card")
    .filter({ hasText: "鑫泰鋁材" })
    .click();
  await expect(page.getByRole("heading", { name: "鑫泰鋁材" })).toBeVisible();

  await page.getByRole("button", { name: "新增", exact: true }).click();
  const seriesDialog = page.getByRole("dialog", { name: "新增產品款式" });
  await seriesDialog.getByLabel("款式名稱", { exact: false }).fill("E2E 顏色系列");
  await seriesDialog.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(seriesDialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "E2E 顏色系列" })).toBeVisible();

  await page.getByRole("button", { name: "上載圖片", exact: true }).click();
  const imageDialog = page.getByRole("dialog", { name: "上載圖片" });
  await imageDialog.locator('input[type="file"]').setInputFiles({
    name: "e2e-style.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ddd"/></svg>',
    ),
  });
  await imageDialog.getByLabel("產品編號", { exact: false }).fill("E2E-001");
  await imageDialog.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(imageDialog).toBeHidden();
  await expect(page.getByText("E2E-001", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("普通CS不可見產品款式module", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "工程CS");
  await expect(
    page.locator("nav").getByRole("link", { name: "產品款式", exact: true }),
  ).toHaveCount(0);
});
