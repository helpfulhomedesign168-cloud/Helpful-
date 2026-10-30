import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Sales可將產品款式snapshot加入報價行", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "SuperAdmin");
  await page.getByRole("link", { name: "產品款式", exact: true }).click();
  await page.getByRole("tab", { name: "PD門", exact: true }).click();
  await page
    .locator(".product-supplier-card")
    .filter({ hasText: "鑫泰鋁材" })
    .click();
  const catalogue = page.getByLabel("小冊子顯示為", { exact: false });
  await catalogue.fill("工廠A");
  await catalogue.blur();
  await page.getByRole("button", { name: "新增", exact: true }).click();
  const series = page.getByRole("dialog", { name: "新增產品款式" });
  await series.getByLabel("款式名稱", { exact: false }).fill("測試系列");
  await series.getByRole("button", { name: "儲存", exact: true }).click();
  await page.getByRole("button", { name: "上載圖片", exact: true }).click();
  const image = page.getByRole("dialog", { name: "上載圖片" });
  await image.locator('input[type="file"]').setInputFiles({
    name: "e2e-style.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ddd"/></svg>',
    ),
  });
  await image.getByLabel("產品編號", { exact: false }).fill("PC-TEST");
  await image.getByRole("button", { name: "儲存", exact: true }).click();
  await expect(image).toBeHidden();

  await switchRole(page, "文文B MM");
  await page.goto("/quotes/new");
  await page.getByRole("button", { name: "新增工程", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "新增工程項目" });
  await picker.getByPlaceholder("搜尋工程名稱").fill("廚房生態夾板吊櫃");
  await page
    .locator(".service-option")
    .filter({ hasText: "廚房生態夾板吊櫃" })
    .first()
    .click();
  const line = page.locator(".line-card");
  await line.getByRole("button", { name: "選擇產品款式", exact: true }).click();
  const style = page.getByRole("dialog", { name: "選擇產品款式" });
  await style.getByRole("button", { name: "PD門", exact: true }).click();
  await style.getByRole("button", { name: "工廠A", exact: true }).click();
  await style.getByText("測試系列", { exact: true }).click();
  await style.locator(".quote-style-image-choice").click();
  await expect(line).toContainText("工廠A · 測試系列");
  await expect(line).toContainText("PC-TEST");
  await expect(line.locator(".quote-style-thumb")).toBeVisible();
  expect(errors).toEqual([]);
});
