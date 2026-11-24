// Drive the harness in Chromium and save screenshots. Usage: bun tests/harness/drive.ts <outDir> [phase]
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(require.resolve("playwright", { paths: ["/opt/node-tools/node_modules", process.cwd()] }));

const out = process.argv[2] ?? ".";
const base = `http://localhost:${process.env.HARNESS_PORT ?? 4417}`;
const browser = await chromium.launch();
const errors: string[] = [];

async function turn(user: string | null, reply: string | null) {
  const r = await fetch(`${base}/turn`, { method: "POST", body: JSON.stringify({ user, reply }) });
  return r.json();
}

const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
page.on("pageerror", (e: any) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m: any) => m.type() === "error" && errors.push(`console: ${m.text()}`));
await page.goto(base);
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/01-setup-modal.png` });

// Choose a birthplace and first bond, then Awaken.
await page.getByRole("button", { name: "Reese's path" }).click();
await page.getByPlaceholder("Your character's name (default: You)").fill("Tamsin");
await page.getByRole("button", { name: "Awaken" }).click();
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/02-after-setup.png` });
const composerText = await page.locator("#composer").inputValue();

// Send the first message; the narrator replies with a change log.
const t1 = await turn(`I wake.\n${composerText}`, 'The Tower answers.\n<ufm>\nform name="Pebble" pillar=elemental element=earth form=puppet\nhand Pebble\n</ufm>');
await page.waitForTimeout(700);

// Queue a Form from the panel.
await page.getByRole("button", { name: "Form", exact: true }).first().click();
await page.waitForTimeout(300);
await page.getByPlaceholder("Shale").fill("Grit");
await page.getByRole("button", { name: "Form", exact: true }).last().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /Roster/ }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${out}/03-panel-roster.png` });
const composer2 = await page.locator("#composer").inputValue();

const t2 = await turn(composer2, 'Grit stands.\n<ufm>\nform name="Grit" pillar=elemental element=earth form=puppet\nkill enemy="Staff warden" level=3 by=Pebble\nfrobnicate the stone\n</ufm>');
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/04-after-kill.png` });

// Mobile layout.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
phone.on("pageerror", (e: any) => errors.push(`phone pageerror: ${e.message}`));
await phone.goto(base);
await phone.waitForTimeout(1200);
await phone.screenshot({ path: `${out}/05-phone.png` });

console.log(JSON.stringify({ errors, composerText, composer2, t1Prompt: t1.prompt?.messages?.find((m: any) => String(m.content).includes("[UFM ORDERS]"))?.content?.slice(0, 600) ?? null, t2ok: !!t2.ok }, null, 2));
await browser.close();
