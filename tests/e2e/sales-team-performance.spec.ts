import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Sales主管只看到自己Team的團隊業績，普通Sales只看到個人業績", async ({
  page,
}) => {
  await page.goto("/");
  await switchRole(page, "世雄B SH");
  await expect(
    page.locator("nav").getByRole("link", { name: "團隊業績", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("link", { name: "團隊業績", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "團隊業績", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".page-head .eyebrow")).toContainText("Team B");
  const teamTable = page.locator(".team-performance");
  await expect(teamTable).toBeVisible();
  await expect(teamTable).toContainText("文文B MM");
  await expect(teamTable).toContainText("嘉嘉B KK");

  await switchRole(page, "嘉嘉B KK");
  await expect(
    page.locator("nav").getByRole("link", { name: "我的業績", exact: true }),
  ).toBeVisible();
  await page
    .locator("nav")
    .getByRole("link", { name: "我的業績", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "我的業績", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".team-performance")).toHaveCount(0);
});

test("Sales阿頭可看全部Team的團隊業績", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "Don A DN（測試碼）");
  await page
    .locator("nav")
    .getByRole("link", { name: "團隊業績", exact: true })
    .click();
  await expect(page.locator(".page-head .eyebrow")).toContainText("全部 Team");
  const teamTable = page.locator(".team-performance");
  await expect(teamTable).toContainText("文文B MM");
  await expect(teamTable).toContainText("嘉嘉B KK");
});
