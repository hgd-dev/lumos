import "./site.js";
import { DOCUMENTATION_ORDER, DOCUMENTATION_PAGES } from "./release/documentation.js";

const navigation = document.querySelector("#infoNavigation");
const content = document.querySelector("#infoContent");

for (const pageKey of DOCUMENTATION_ORDER) {
  const page = DOCUMENTATION_PAGES[pageKey];
  const link = document.createElement("a");
  link.href = `#${pageKey}`;
  link.textContent = page.title;
  navigation?.append(link);

  const section = document.createElement("section");
  section.id = pageKey;
  section.className = "info-document-section";
  section.innerHTML = `<p class="section-kicker"></p><h2></h2><p class="info-section-summary"></p><div class="info-section-body"></div>`;
  section.querySelector(".section-kicker").textContent = page.kicker;
  section.querySelector("h2").textContent = page.title;
  section.querySelector(".info-section-summary").textContent = page.summary;
  section.querySelector(".info-section-body").innerHTML = page.html;
  content?.append(section);
}

const links = [...document.querySelectorAll("#infoNavigation a")];
const sections = [...document.querySelectorAll(".info-document-section")];
const updateActive = () => {
  const hash = location.hash.slice(1) || DOCUMENTATION_ORDER[0];
  links.forEach((link) => link.classList.toggle("active", link.hash === `#${hash}`));
};
window.addEventListener("hashchange", updateActive);
updateActive();

if (location.hash) window.setTimeout(() => document.querySelector(location.hash)?.scrollIntoView({ block: "start" }), 0);
