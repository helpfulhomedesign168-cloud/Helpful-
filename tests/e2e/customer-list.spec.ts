import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("開單員客戶列表顯示 Sales 欄及可按 Sales 篩選", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "開單員");
  await page.goto("/customers");

  await expect(
    page.getByRole("columnheader", { name: "Sales", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "相關訂單", exact: true }),
  ).toBeVisible();
  const firstCustomerRow = page.locator("tbody tr").filter({ hasText: "張偉強" });
  await expect(
    firstCustomerRow.getByRole("button", { name: /^查看/ }),
  ).toHaveCount(0);
  await expect(firstCustomerRow.locator(".related-order-link")).toHaveCount(1);
  await firstCustomerRow.locator(".related-order-link").click();
  await expect(page).toHaveURL(/\/quotes\//);
  await page.goBack();

  const wenwenRow = page.locator("tbody tr").filter({ hasText: "陳小強" });
  const kakaRow = page.locator("tbody tr").filter({ hasText: "太大力" });
  await expect(wenwenRow).toContainText("文文B MM");
  await expect(kakaRow).toContainText("嘉嘉B KK");

  const salesFilter = page.getByLabel("Sales", { exact: true });
  await salesFilter.selectOption({ label: "文文B MM" });
  await expect(wenwenRow).toBeVisible();
  await expect(kakaRow).toHaveCount(0);

  await salesFilter.selectOption({ label: "嘉嘉B KK" });
  await expect(kakaRow).toBeVisible();
  await expect(wenwenRow).toHaveCount(0);
  expect(errors).toEqual([]);
});


test("CS客戶列表顯示相關工程單而非箭咀", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "阿花");
  await page.goto("/customers");
  await expect(
    page.getByRole("columnheader", { name: "相關訂單", exact: true }),
  ).toBeVisible();
  const row = page.locator("tbody tr").first();
  await expect(row.getByRole("button", { name: /^查看/ })).toHaveCount(0);
  const link = row.locator(".related-order-link");
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(/\/orders\//);
});
