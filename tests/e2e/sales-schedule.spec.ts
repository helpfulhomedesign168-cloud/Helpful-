import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Sales阿頭可編排全部Team月度更表，普通Sales只讀自己排班", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await expect(
    page.locator("nav").getByRole("link", { name: "Sales排班", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("link", { name: "Sales排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sales排班", exact: true }),
  ).toBeVisible();
  const shift = page.getByLabel("文文B MM 2026-10-05 排班");
  await shift.selectOption("morning");
  await expect(shift).toHaveValue("morning");
  await expect(
    page.locator(".roster-coverage td").nth(4),
  ).toContainText("1");

  await page.reload();
  await expect(page.getByLabel("文文B MM 2026-10-05 排班")).toHaveValue(
    "morning",
  );

  await switchRole(page, "嘉嘉B KK");
  await expect(
    page.locator("nav").getByRole("link", { name: "我的排班", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("link", { name: "我的排班", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "我的排班", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".sales-roster-table select")).toHaveCount(0);
  await expect(page.locator(".sales-roster-table tbody tr")).toHaveCount(2);
});
