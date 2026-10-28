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
  await expect(page.locator(".service-table tbody tr")).toHaveCount(6);
  await expect(page.getByText("更換所有來水喉管 (明喉)", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "全部", exact: true }).click();
  await expect(page.locator(".service-table tbody tr")).toHaveCount(30);

  await page.getByRole("button", { name: "新增工程項目", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "新增工程項目" });
  const nameInput = dialog.getByLabel("工程名稱", { exact: false });
  await nameInput.pressSequentially("E2E 水喉工程");
  await expect(nameInput).toHaveValue("E2E 水喉工程");
  await dialog.getByLabel("工程分類", { exact: false }).selectOption("水喉");
  await dialog.getByLabel("工程範圍", { exact: false }).selectOption("全屋");
  await dialog.getByLabel("工程詳細", { exact: false }).fill("E2E 工程詳細");
  await dialog.getByRole("radio", { name: "固定價", exact: true }).check();
  await dialog.getByLabel(/零售價/, { exact: false }).fill("800");
  await dialog.getByRole("button", { name: "新增連貫工程", exact: true }).click();
  const linkDialog = page.getByRole("dialog", { name: "新增連貫工程" });
  await linkDialog
    .getByRole("checkbox", { name: /^廚房牆身\/地台 清拆打鑿/ })
    .check();
  await linkDialog.getByRole("button", { name: "完成", exact: true }).click();
  await dialog.getByRole("button", { name: "儲存工程項目", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("tab", { name: "水喉項目", exact: true }).click();
  const row = page.getByText("E2E 水喉工程", { exact: true });
  await expect(row).toBeVisible();
  await expect(page.getByText("E2E 工程詳細", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "修改E2E 水喉工程", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "修改工程項目" });
  await expect(edit.getByRole("radio", { name: "固定價", exact: true })).toBeDisabled();
  await expect(edit.getByText("廚房牆身/地台 清拆打鑿", { exact: true })).toBeVisible();
  await edit.getByRole("button", { name: "取消", exact: true }).click();
  await page.getByRole("button", { name: "刪除E2E 水喉工程", exact: true }).click();
  const removeDialog = page.getByRole("dialog", { name: "刪除工程項目" });
  await removeDialog.getByRole("button", { name: "刪除", exact: true }).click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});
