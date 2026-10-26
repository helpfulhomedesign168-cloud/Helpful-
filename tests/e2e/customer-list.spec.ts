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
