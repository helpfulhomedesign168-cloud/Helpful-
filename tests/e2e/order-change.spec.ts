import { expect, test } from "@playwright/test";

test("更改訂單會建立新版本並要求重新簽署", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "SuperAdmin" }).first().click();
  await page.goto("/quotes/quote-ready-invoice");
  await page.getByRole("button", { name: "更改訂單", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/.+\/edit\?order=1/);
  await expect(
    page.getByRole("button", { name: "儲存修改", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("客戶姓名", { exact: false })).toHaveCount(0);
  const width = page
    .locator(".line-card")
    .first()
    .getByLabel("闊度", { exact: false });
  if (await width.count()) await width.fill("9");
  await page.getByRole("button", { name: "儲存修改", exact: true }).click();
  await expect(page).toHaveURL(/\/quotes\/quote-ready-invoice$/);
  await expect(
    page.getByRole("button", { name: /上載已簽文件/ }),
  ).toBeVisible();
  await expect(page.getByText(/重新列印/).first()).toBeVisible();
  await expect(
    page.locator(".submitted-card").filter({ hasText: "1. 客戶簽署" }),
  ).not.toContainText("✓ 已完成");
  await page.getByRole("button", { name: "8萬資助", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "不能移除 8萬資助" }),
  ).toBeVisible();
});
