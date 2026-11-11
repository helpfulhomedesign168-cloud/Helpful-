import { expect, test } from "@playwright/test";

test("報價單使用新 quotation 版面", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "文文B MM" }).first().click();
  await page.goto("/documents/quote/quote-pending-office");
  await expect(page.locator(".quotation-sheet")).toBeVisible();
  await expect(page.getByText("QUOTATION", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "工程報價單", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quotation-sheet .document-table")).toContainText(
    "PD門",
  );
  await expect(page.getByText("客戶入帳戶口", { exact: true })).toBeVisible();
  await expect(page.getByText("公司蓋印", { exact: false })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "返回", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "列印／另存PDF", exact: true }),
  ).toHaveCount(0);
});
