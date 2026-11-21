import { expect, test, type Page } from "@playwright/test";

async function login(page: Page, phone: string) {
  await page.goto("/login");
  await page.locator("#phone").fill(phone);
  await page.getByRole("button", { name: /कोड भेजें|Send code/ }).click();
  await page.locator("#code").fill("123456");
  await expect(page).toHaveURL(/\/today$/, { timeout: 20_000 });
}

const mobile = () => `6${String(Math.floor(Math.random() * 1e9)).padStart(9, "0")}`;

test("a student fills the QR form without logging in, and the owner confirms them", async ({ page, browser }) => {
  await login(page, "9999900001");
  await page.goto("/more/join");
  const link = (await page.locator(".poster p.text-xs").innerText()).trim();
  const path = new URL(link).pathname;

  // Student on their own phone, not logged in.
  const student = await (await browser.newContext()).newPage();
  const phone = mobile();
  await student.goto(path);
  await student.locator("#j-name").fill("QR Student");
  await student.locator("#j-phone").fill(phone);
  await student.getByRole("radio", { name: /Morning/ }).click();
  await student.getByRole("button", { name: "भेजें" }).click();
  await expect(student.getByText("धन्यवाद, QR!")).toBeVisible();

  // Owner sees the request (no fee date/seat → needs checking) and confirms it.
  await page.goto("/students/requests");
  const card = page.locator("li", { hasText: "QR Student" });
  await expect(card.getByText("फीस की तारीख नहीं बताई").first()).toBeVisible();
  await card.getByRole("button", { name: "देखें और पक्का करें" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "पक्का करें" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Gone from the requests list (it now shows up in the student list instead).
  await expect(page.getByRole("list", { name: "नए अनुरोध" }).locator("li", { hasText: "QR Student" })).toHaveCount(0);

  await page.goto("/students");
  await page.getByPlaceholder("नाम, फ़ोन या सीट से खोजें").fill(phone.slice(-6));
  // Waits for the search to filter the list down to this one student.
  await expect(page.locator("main ul li").filter({ hasText: "QR Student" })).toHaveCount(1);
});

test("a wrong join link says so and shows no library data", async ({ page }) => {
  await page.goto("/join/notareallink");
  await expect(page.getByText("ये लिंक काम नहीं कर रहा")).toBeVisible();
});

test("owner can add an existing student by hand without it counting as today's earnings", async ({ page }) => {
  await login(page, "9999900001");
  await expect(page.getByText("आज की कमाई")).toBeVisible();
  const before = await page.locator("section").first().innerText();
  await page.goto("/students/requests");
  await page.getByRole("button", { name: "खुद जोड़ें" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.locator("#rq-name").fill("Old Register Student");
  await sheet.locator("#rq-phone").fill(mobile());
  await sheet.getByRole("button", { name: "पक्का करें" }).click();
  await expect(sheet).toHaveCount(0);
  await page.goto("/today");
  await expect(page.getByText("आज की कमाई")).toBeVisible();
  const after = await page.locator("section").first().innerText();
  expect(after.split("\n").slice(0, 3)).toEqual(before.split("\n").slice(0, 3));
});
