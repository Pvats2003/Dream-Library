import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Send code/ }).click();
  await page.locator("#code").fill("123456");
  await expect(page).toHaveURL(/\/today$/, { timeout: 20_000 });
}

test("tap a seat, move the student to a free seat, then undo", async ({ page }) => {
  await login(page, "9999900001");
  await page.goto("/seats");
  const taken = page.getByRole("button", { name: /^सीट \S+, [^ख]/ }).first();
  const fromLabel = (await taken.getAttribute("aria-label"))!.match(/^सीट (\S+),/)![1];
  await taken.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: `सीट ${fromLabel}` })).toBeVisible();
  await sheet.getByRole("button", { name: "सीट बदलें" }).first().click();

  const free = page.getByRole("button", { name: /^सीट \S+, खाली$/ }).first();
  const toLabel = (await free.getAttribute("aria-label"))!.match(/^सीट (\S+),/)![1];
  await free.click();
  await expect(page.getByText(new RegExp(`अब सीट ${toLabel} पर`))).toBeVisible();
  await page.getByRole("button", { name: "वापस करें" }).click();
  await expect(page.getByRole("button", { name: new RegExp(`^सीट ${toLabel}, खाली$`) })).toBeVisible({ timeout: 10_000 });
});

test("open a student's profile and see their plan, payments and attendance", async ({ page }) => {
  await login(page, "9999900002");
  await page.goto("/students");
  await page.locator("main ul li a").first().click();
  await expect(page).toHaveURL(/\/students\/[0-9a-f-]{36}$/);
  await expect(page.getByText("अभी का प्लान")).toBeVisible();
  for (const tab of ["पेमेंट", "हाज़िरी", "नोट"]) {
    await page.getByRole("radio", { name: tab }).click();
  }
  await expect(page.getByRole("button", { name: "नोट सेव करें" })).toBeVisible();
});

test("desk staff cannot mark a student as left", async ({ page }) => {
  await login(page, "9999900003");
  await page.goto("/students");
  await page.locator("main ul li a").first().click();
  await expect(page.getByText("अभी का प्लान")).toBeVisible();
  await expect(page.getByRole("button", { name: "लाइब्रेरी छोड़ दी" })).toHaveCount(0);
});

test("owner can open library setup from More and see the current layout", async ({ page }) => {
  await login(page, "9999900001");
  await page.goto("/more");
  await page.getByRole("link", { name: /लाइब्रेरी सेटअप बदलें/ }).click();
  await expect(page).toHaveURL(/\/setup\/seats$/);
  await expect(page.getByText(/कुल 59 सीटें/)).toBeVisible();
  await expect(page.locator('input[id^="zn-"]')).toHaveCount(3);
});

test("desk staff cannot open library setup", async ({ page }) => {
  await login(page, "9999900003");
  await page.goto("/more");
  await expect(page.getByRole("link", { name: /लाइब्रेरी सेटअप बदलें/ })).toHaveCount(0);
  await page.goto("/setup/seats");
  await expect(page).toHaveURL(/\/today$/);
});
