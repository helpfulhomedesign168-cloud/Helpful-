import { expect, test } from "@playwright/test";

async function switchRole(page: import("@playwright/test").Page, name: string) {
  await page.locator(".actor-button").click();
  await page.locator(".role-option").filter({ hasText: name }).first().click();
}

test("Invoice每期收據按鈕靠右，與可發收據標籤對齊", async ({ page }) => {
  await page.goto("/");
  await switchRole(page, "開單員");
  await page.goto("/invoices/invoice-issued");
  const cards = page.locator(".installment-card");
  await expect(cards).toHaveCount(4);
  await expect(
    page.getByRole("button", { name: "開收據", exact: true }),
  ).toHaveCount(2);

  for (let index = 0; index < 2; index += 1) {
    const card = cards.nth(index);
    const button = card.getByRole("button", {
      name: "開收據",
      exact: true,
    });
    const badge = card.getByText("可發收據", { exact: true });
    const [buttonBox, badgeBox] = await Promise.all([
      button.boundingBox(),
      badge.boundingBox(),
    ]);
    expect(buttonBox).not.toBeNull();
    expect(badgeBox).not.toBeNull();
    const buttonRight = buttonBox!.x + buttonBox!.width;
    const badgeRight = badgeBox!.x + badgeBox!.width;
    expect(Math.abs(buttonRight - badgeRight)).toBeLessThan(3);
  }
});
