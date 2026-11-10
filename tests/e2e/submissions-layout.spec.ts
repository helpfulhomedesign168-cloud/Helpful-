import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("提交報價：搜尋及三個篩選同一行，分類及狀態正確", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (event) => errors.push(event.message));
  await page.goto("/");
  await switchRole(page, "開單員");
  await expect(
    page.getByRole("heading", { name: "提交報價", exact: true }),
  ).toBeVisible();

  const search = page.getByPlaceholder("搜尋工程名稱或代號");
  const category = page.getByLabel("來源分類", { exact: true });
  const team = page.getByLabel("來源Team", { exact: true });
  const sales = page.getByLabel("Sales", { exact: true });
  await expect(search).toBeVisible();
  await expect(category).toBeVisible();
  await expect(team).toBeVisible();
  await expect(sales).toBeVisible();

  const boxes = await Promise.all([
    search.boundingBox(),
    category.boundingBox(),
    team.boundingBox(),
    sales.boundingBox(),
  ]);
  const centres = boxes.map((box) => box!.y + box!.height / 2);
  expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(2);

  await expect(
    page.getByRole("columnheader", { name: "日期", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "分類", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "首訂金額", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "狀態", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "證明文件", exact: true }),
  ).toHaveCount(0);

  const classified = page
    .locator("tbody tr")
    .filter({ hasText: "QSHKK26100005" });
  await expect(classified).toContainText("8萬");
  await expect(
    classified.getByRole("button", { name: /已核對並開單/ }),
  ).toBeVisible();

  const unclassified = page
    .locator("tbody tr")
    .filter({ hasText: "QSHMM26100004" });
  await expect(unclassified).toContainText("待Sales分類");
  await expect(
    unclassified.getByRole("button", { name: "核對收款", exact: true }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1600, height: 900 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
