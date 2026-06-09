import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertTransparentPng(relativePath) {
  const file = path.join(root, relativePath);
  assert(exists(relativePath), `${relativePath} is missing.`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const corners = [
    3,
    (info.width - 1) * info.channels + 3,
    (info.height - 1) * info.width * info.channels + 3,
    ((info.height - 1) * info.width + info.width - 1) * info.channels + 3
  ];
  assert(corners.some((index) => data[index] === 0), `${relativePath} does not appear to have a transparent edge.`);
}

const indexHtml = read("dist/index.html");
const manifest = JSON.parse(read("dist/manifest.webmanifest"));
const serviceWorker = read("dist/sw.js");

assert(indexHtml.includes("/manifest.webmanifest"), "Built index is missing the manifest link.");
assert(indexHtml.includes("/favicon.png"), "Built index is missing the PNG favicon.");
assert(indexHtml.includes("#020b18"), "Built index is missing the HAAK theme color.");
assert(manifest.theme_color === "#020b18", "Manifest theme_color is not the HAAK navy color.");
assert(manifest.icons.some((icon) => icon.src === "/icons/favicon-192.png"), "Manifest is missing the 192px icon.");
assert(manifest.icons.some((icon) => icon.src === "/icons/favicon-512.png"), "Manifest is missing the 512px icon.");
assert(serviceWorker.includes("request.mode === \"navigate\""), "Service worker is missing navigation handling.");
assert(serviceWorker.includes("isApiRequest"), "Service worker is missing API cache exclusion.");
assert(serviceWorker.includes("/uploads/"), "Service worker is missing upload asset handling.");
assert(serviceWorker.includes("staleWhileRevalidate"), "Service worker is missing stale-while-revalidate handling.");

await assertTransparentPng("dist/haak-logo-transparent.png");
await assertTransparentPng("dist/favicon.png");
assert(exists("dist/icons/favicon-192.png"), "Built 192px favicon is missing.");
assert(exists("dist/icons/favicon-512.png"), "Built 512px favicon is missing.");

console.log("PWA verification passed.");
