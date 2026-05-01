const fs = require("fs");

// JSON load
const cities = JSON.parse(fs.readFileSync("./data/cities.json", "utf-8"));

// slug function (important)
function slugify(text) {
  return text.toLowerCase().trim().replace(/\s+/g, "-");
}

cities.forEach((item) => {
  const cityName = item.city;
  const stateName = item.state;

  const citySlug = slugify(cityName);
  const stateSlug = slugify(stateName);

  const content = `---
layout: default
title: ${cityName}, ${stateName}
state: ${stateSlug}
city: ${citySlug}
permalink: /${stateSlug}/${citySlug}/
---

<h1>${cityName}, ${stateName}</h1>
<div id="app"></div>
`;

  // file create
  fs.writeFileSync(cities/${citySlug}.md, content);

  console.log("Created:", citySlug);
});
