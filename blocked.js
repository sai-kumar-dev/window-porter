"use strict";
let original = "";
try {
  original = decodeURIComponent(location.hash.slice(1));
} catch {
  original = location.hash.slice(1);
}

function isSafeClickableUrl(rawUrl) {
  try {
    const protocol = new URL(rawUrl).protocol.toLowerCase();
    return !["javascript:", "data:", "blob:", "vbscript:"].includes(protocol);
  } catch {
    return false;
  }
}

document.getElementById("url").textContent = original || "(missing URL)";
const link = document.getElementById("link");
if (original && isSafeClickableUrl(original)) {
  link.href = original;
  link.target = "_blank";
  link.rel = "noreferrer";
} else {
  link.hidden = true;
}
