import { expect, test } from "@playwright/test";

test("已提交列表報價號會開新報價單版面", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "文文B MM" }).first().click();
  await page.goto("/quotes?tab=submitted");
  const first = page.locator("tbody tr").first();
  const number = (await first.locator("a.source-link").innerText()).trim();
  await first.locator("a.source-link").click();
  await expect(page).toHaveURL(/\/quotes\/quote-/);
  await expect(page.getByRole("heading", { name: number, exact: true })).toBeVisible();
  await expect(page.getByTitle("正式報價單")).toBeVisible();
  await expect(page.getByRole("button", { name: "返回列表", exact: true })).toBeVisible();
  await expect(page.getByText("報價摘要", { exact: true })).toBeVisible();
});
