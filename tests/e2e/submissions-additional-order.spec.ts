import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("開單員提交報價列表顯示加單及原單號", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "文文B MM");
  await page.goto("/quotes/quote-pending-office");
  await page.getByRole("button", { name: "是", exact: true }).click();
  await page
    .getByLabel("原本報價單", { exact: true })
    .selectOption("quote-draft-2");

  await switchRole(page, "開單員");
  await page.goto("/submissions");
  const row = page
    .locator(".submission-table tbody tr")
    .filter({ hasText: "李好波" });
  await expect(row).toContainText("加單");
  await expect(row).toContainText("原單 QMM26100002");
  await expect(row).toContainText("陳小強");
  expect(errors).toEqual([]);
});
