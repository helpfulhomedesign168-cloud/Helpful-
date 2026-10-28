import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("工程管理：主管看全部、普通CS只看自己、日曆、逐項安排及現場圖片", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "阿花");
  await page.goto("/handoff");
  const handoffRow = page.locator("tbody tr").filter({ hasText: "D2600001" });
  await handoffRow.getByRole("button", { name: "安排工程", exact: true }).click();
  const assignDialog = page.getByRole("dialog", { name: "安排CS跟進" });
  await assignDialog
    .getByRole("combobox")
    .selectOption({ label: "Joe（工程CS）" });
  await assignDialog.getByRole("button", { name: "儲存安排", exact: true }).click();

  await page.getByRole("link", { name: "工程管理", exact: true }).click();
  const rail = page.locator(".order-rail");
  await expect(rail).toContainText("D2600001");
  await rail.getByLabel("跟進同事", { exact: true }).selectOption({ label: "Joe" });
  await expect(rail).toContainText("D2600001");
  await rail.getByLabel("跟進同事", { exact: true }).selectOption({ label: "Nicole" });
  await expect(rail.locator(".order-rail-row")).toHaveCount(0);
  await rail.getByLabel("跟進同事", { exact: true }).selectOption({ label: "全部同事" });
  await rail.locator(".order-rail-row").filter({ hasText: "D2600001" }).click();

  await expect(
    page.getByRole("heading", { name: "D2600001", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "工程日曆" })).toBeVisible();

  const photoInput = page.locator(".site-photo-upload input[type=file]");
  await photoInput.setInputFiles([
    {
      name: "地盤1.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#eee"/><text x="20" y="80">SITE 1</text></svg>',
      ),
    },
    {
      name: "地盤2.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150"><rect width="200" height="150" fill="#ddd"/><text x="20" y="80">SITE 2</text></svg>',
      ),
    },
  ]);
  await expect(page.locator(".site-photo-thumb")).toHaveCount(2);
  await expect(page.locator(".site-photo-large img")).toBeVisible();

  await page.getByRole("button", { name: "安排", exact: true }).first().click();
  const resourceSelect = page.getByLabel("執行師傅", { exact: false });
  await resourceSelect.selectOption({ index: 1 });
  await page.getByLabel("開工日期", { exact: false }).fill("2026-11-05");
  await page.getByLabel("完工日期", { exact: false }).fill("2026-11-07");
  await page.getByLabel("時段", { exact: false }).selectOption("上午");
  await page.getByLabel("安排備註", { exact: false }).fill("E2E 現場安排");
  await page.getByRole("button", { name: "儲存安排", exact: true }).click();
  await expect(
    page
      .locator(".calendar-cell.has-events")
      .filter({ hasText: "上午" }),
  ).toHaveCount(1);
  const itemRow = page
    .locator(".engineering-table tbody tr")
    .filter({ hasText: "木門" });
  await expect(itemRow).toContainText("2026-11-05");
  await expect(itemRow).toContainText("2026-11-07");

  await page.getByRole("button", { name: "更改安排", exact: true }).click();
  await expect(page.getByLabel("時段", { exact: false })).toHaveValue("上午");
  await page.getByLabel("時段", { exact: false }).selectOption("下午");
  await page.getByRole("button", { name: "儲存安排", exact: true }).click();
  await expect(
    page
      .locator(".calendar-cell.has-events")
      .filter({ hasText: "下午" })
      .first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "安排度尺", exact: true }).click();
  const extraDialog = page.getByRole("dialog", { name: "安排度尺" });
  await extraDialog
    .getByLabel("執行師傅", { exact: false })
    .selectOption({ index: 1 });
  await extraDialog.getByLabel("開工日期", { exact: false }).fill("2026-11-08");
  await extraDialog.getByLabel("完工日期", { exact: false }).fill("2026-11-09");
  await extraDialog.getByLabel("時段", { exact: false }).selectOption("下午");
  await extraDialog
    .getByLabel("安排備註", { exact: false })
    .fill("E2E 度尺安排");
  await extraDialog.getByRole("button", { name: "儲存安排", exact: true }).click();
  await expect(
    page.locator(".engineering-table tbody tr").filter({ hasText: "度尺" }),
  ).toContainText("2026-11-08");
  await expect(
    page
      .locator(".calendar-cell.has-events")
      .filter({ hasText: "度尺" })
      .first(),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator(".site-photo-thumb")).toHaveCount(2);
  await expect(
    page
      .locator(".calendar-cell.has-events")
      .filter({ hasText: "下午" })
      .first(),
  ).toBeVisible();

  await switchRole(page, "Joe");
  await page.goto("/orders");
  await expect(
    page.locator(".order-rail-row").filter({ hasText: "D2600001" }),
  ).toBeVisible();
  await page.locator(".order-rail-row").filter({ hasText: "D2600001" }).click();
  await expect(
    page.getByRole("heading", { name: "D2600001", exact: true }),
  ).toBeVisible();

  await switchRole(page, "Nicole");
  await page.goto("/orders");
  await expect(page.locator(".order-rail-row").filter({ hasText: "D2600001" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
