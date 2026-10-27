import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("工程價目只顯示新catalog六項，分類tag及新增項目可運作", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "SuperAdmin");
  await page.getByRole("link", { name: "工程價目", exact: true }).click();
  await expect(page.locator(".service-table tbody tr")).toHaveCount(6);
  await expect(
    page.locator(".service-table").getByText("廚房牆身/地台 清拆打鑿", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("防水工程", { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "水喉項目", exact: true }).click();
  await expect(page.getByText("此分類未有工程項目", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "全部", exact: true }).click();
  await expect(page.locator(".service-table tbody tr")).toHaveCount(6);

  await page.getByRole("button", { name: "新增工程項目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增工程項目" });
  await dialog.getByLabel("工程名稱", { exact: false }).fill("E2E 水喉工程");
  await dialog.getByLabel("工程分類", { exact: false }).selectOption("水喉");
  await dialog.getByLabel("怎樣計價", { exact: false }).selectOption("fixed");
  await dialog.getByLabel("出街單價", { exact: false }).fill("800");
  await dialog.getByLabel("最低計費量", { exact: false }).fill("1");
  await dialog.getByRole("button", { name: "其他規則", exact: true }).click();
  await dialog.getByLabel("工程範圍", { exact: false }).fill("全屋");
  await dialog.getByRole("button", { name: "儲存工程項目", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("tab", { name: "水喉項目", exact: true }).click();
  await expect(page.getByText("E2E 水喉工程", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
