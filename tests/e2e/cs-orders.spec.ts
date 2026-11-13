import { expect, test } from "@playwright/test";

test("CS工程單預設最新排頭、可切換排序及用Invoice搜尋", async ({ page }) => {
  await page.goto("/");
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: "阿花" }).first().click();
  await page.goto("/handoff");
  await expect(page.getByLabel("排序")).toHaveValue("newest");
  const firstNewest = await page.locator(".handoff-table tbody tr").first().innerText();
  await page.getByLabel("排序").selectOption("oldest");
  await expect(page.getByLabel("排序")).toHaveValue("oldest");
  const firstOldest = await page.locator(".handoff-table tbody tr").first().innerText();
  expect(firstOldest).not.toBe(firstNewest);
  await page.getByPlaceholder(/Invoice/).fill("SHMM26100227");
  await expect(page.locator(".handoff-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".handoff-table tbody tr").first()).toContainText(
    "D2600227",
  );
});
