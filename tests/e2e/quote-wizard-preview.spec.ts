import { expect, test } from "@playwright/test";

test("Sales可預覽4步建立報價流程", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "文文B MM" }).first().click();
  await page.goto("/design/quote");
  await expect(page.getByRole("heading", { name: "建立報價", exact: true })).toBeVisible();
  await expect(page.locator(".quote-wizard-step")).toHaveCount(4);
  await page.getByRole("button", { name: /下一步/ }).click();
  await expect(page.getByText("打拆工程", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /下一步/ }).click();
  await expect(page.getByText("列印報價單", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await expect(page.getByText("報價單號碼：", { exact: false })).toBeVisible();
  await expect(page.getByText("提交Office", { exact: true })).toBeVisible();
});
