// =======================
// ====== ELEMENTS =======
// =======================
const input = document.getElementById("search");
const dropdown = document.getElementById("dropdown");
const suggestions = document.getElementById("suggestions");
const loader = document.getElementById("loader");
const noResults = document.getElementById("noResults");

// =======================
// ====== STATE =========
// =======================
let cities = [];
let fuse = null;
let prefixMap = new Map();
let citySet = new Set();
let currentFocus = -1;

// =======================
// ====== HELPERS ========
// =======================

// slugify
function slugify(text) {
  return (text || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

// Title Case
function toTitleCase(text) {
  return text
    .replace(/-/g, " ")
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// format display
function formatText(slug) {
  return slug ? toTitleCase(slug) : "";
}

// normalize
function norm(s) {
  return (s || "").toLowerCase();
}

// debounce
function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

// validate city
function isValidCity(city, state) {
  return citySet.has(`${city}-${state}`);
}

// =======================
// ====== INDEX =========
// =======================

function buildIndex(data) {
  prefixMap.clear();

  data.forEach(item => {
    const name = norm(item.city);

    for (let i = 1; i <= name.length; i++) {
      const p = name.slice(0, i);
      if (!prefixMap.has(p)) prefixMap.set(p, []);
      prefixMap.get(p).push(item);
    }
  });
}

// fast validation set
function buildCitySet(data) {
  citySet.clear();

  data.forEach(item => {
    const key = `${slugify(item.city)}-${slugify(item.state)}`;
    citySet.add(key);
  });
}

// =======================
// ====== UI STATES ======
// =======================

function showLoader(count = 5) {
  suggestions.innerHTML = "";
  noResults.style.display = "none";
  loader.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const div = document.createElement("div");
    div.className = "loader-item";
    loader.appendChild(div);
  }
}

function hideLoader() {
  loader.innerHTML = "";
}

function showNoResults() {
  suggestions.innerHTML = "";
  hideLoader();
  noResults.style.display = "block";
}

// =======================
// ====== RENDER =========
// =======================

function highlight(text, query) {
  if (!query) return text;

  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return text.replace(
    new RegExp(safe, "gi"),
    match => `<mark>${match}</mark>`
  );
}

function showSuggestions(list, query) {
  hideLoader();
  noResults.style.display = "none";
  suggestions.innerHTML = "";
  currentFocus = -1;

  list.forEach(item => {
    const li = document.createElement("li");

    li.innerHTML = `
      <span class="city">${highlight(item.city, query)}</span>
      <span class="state">${item.state}</span>
    `;

    li.onclick = () => {
      input.value = `${item.city}, ${item.state}`;
      closeDropdown();
    };

    suggestions.appendChild(li);
  });
}

// =======================
// ====== DROPDOWN =======
// =======================

function openDropdown() {
  dropdown.classList.remove("hidden");
}

function closeDropdown() {
  dropdown.classList.add("hidden");
  suggestions.innerHTML = "";
  hideLoader();
  noResults.style.display = "none";
  currentFocus = -1;
}

// =======================
// ====== KEYBOARD =======
// =======================

function addActive(items) {
  if (!items.length) return;

  removeActive(items);

  if (currentFocus >= items.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = items.length - 1;

  items[currentFocus].classList.add("active");
}

function removeActive(items) {
  [...items].forEach(i => i.classList.remove("active"));
}

input.addEventListener("keydown", (e) => {
  const items = suggestions.getElementsByTagName("li");

  if (e.key === "ArrowDown") {
    currentFocus++;
    addActive(items);
  } else if (e.key === "ArrowUp") {
    currentFocus--;
    addActive(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (currentFocus > -1 && items[currentFocus]) {
      items[currentFocus].click();
    }
  } else if (e.key === "Escape") {
    closeDropdown();
  }
});

// =======================
// ====== SEARCH =========
// =======================

const handleSearch = debounce(() => {
  const query = norm(input.value.trim());

  if (!query) return closeDropdown();

  openDropdown();

  let predicted = prefixMap.get(query)?.length || 5;
  predicted = Math.min(predicted, 8);

  showLoader(predicted);

  setTimeout(() => {
    let results = prefixMap.get(query) || fuse.search(query).map(x => x.item);

    if (!results.length) return showNoResults();

    showSuggestions(results.slice(0, 8), query);
  }, 150);

}, 250);

input.addEventListener("input", handleSearch);

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-box")) closeDropdown();
});

// =======================
// ====== INIT ===========
// =======================

fetch("https://vinku.in/data/cities.json")
  .then(res => res.json())
  .then(data => {
    cities = data;
    buildIndex(cities);
    buildCitySet(cities);

    fuse = new Fuse(cities, {
      keys: ["city", "state"],
      threshold: 0.3,
      ignoreLocation: true
    });
  });

// =======================
// ====== RECENT SEARCH ==
// =======================

const MAX_ITEMS = 10;

function saveSearch(city, state, category) {
  if (!city && !category) return;

  let searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

  const newItem = { city, state, category };

  searches = searches.filter(i =>
    !(i.city === city && i.category === category)
  );

  searches.unshift(newItem);
  searches = searches.slice(0, MAX_ITEMS);

  localStorage.setItem("recentSearches", JSON.stringify(searches));
}

function buildUrl(state, city, category) {
  if (state && city && category) return `/${state}/${city}/${category}/`;
  if (state && city) return `/${state}/${city}/`;
  if (category) return `/${category}/`;
  return "/";
}

// =======================
// ====== MAIN SEARCH ====
// =======================

function searchCity() {

  let rawInput = document.getElementById("search").value.trim();
  let rawCategory = document.getElementById("category").value;

  let city = "";
  let state = "";

  if (rawInput) {
    const parts = rawInput.split(",");
    city = parts[0]?.trim();
    state = parts[1]?.trim();
  }

  city = slugify(city);
  state = slugify(state);
  const category = slugify(rawCategory);

  // SAVE
  if (city || category) {

    if (city) {
      if (!isValidCity(city, state)) {
        alert("City not found");
        return;
      }
    }

    saveSearch(city, state, category);
  }

  // REDIRECT
  window.location.href = buildUrl(state, city, category);
}

// =======================
// ====== RECENT UI ======
// =======================

function loadRecentSearches() {

  const container = document.getElementById("recent-container");
  const wrapper = document.getElementById("recent-chips");

  if (!container || !wrapper) return;

  const searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

  wrapper.innerHTML = "";

  if (!searches.length) {
    container.style.display = "none";
    return;
  }

  container.style.display = "block";

  searches.forEach(item => {

    const chip = document.createElement("div");
    chip.className = "chip";

    const url = buildUrl(item.state, item.city, item.category);

    const parts = [];

    if (item.city) parts.push(formatText(item.city));
    if (item.state) parts.push(formatText(item.state));

    let label = parts.join(", ");

    if (item.category) {
      const cat = toTitleCase(item.category);
      label = label ? `${label} (${cat})` : cat;
    }

    chip.innerText = label;

    chip.onclick = () => window.location.href = url;

    wrapper.appendChild(chip);
  });
}

function clearRecent() {
  localStorage.removeItem("recentSearches");
  loadRecentSearches();
}

document.addEventListener("DOMContentLoaded", loadRecentSearches);













// // ====== Elements ======
// const input = document.getElementById("search");
// const dropdown = document.getElementById("dropdown");
// const suggestions = document.getElementById("suggestions");
// const loader = document.getElementById("loader");
// const noResults = document.getElementById("noResults");

// // ====== State ======
// let cities = [];
// let fuse = null;
// let prefixMap = new Map();
// let currentFocus = -1;

// // City Validate
// function isValidCity(city, state) {
//   return citySet.has(`${city}-${state}`);
// }

// // Totitle
// function toTitleCase(text) {
//   return text
//     .replace(/-/g, " ")
//     .split(" ")
//     .map(word => word.charAt(0).toUpperCase() + word.slice(1))
//     .join(" ");
// }

// // ====== slugify ======
// function slugify(text) {
//   return text
//     .toLowerCase()
//     .trim()
//     .replace(/\s+/g, "-")
//     .replace(/[^\w\-]+/g, "")
//     .replace(/\-\-+/g, "-");
// }
// // Format Text
// function formatText(slug) {
//   return slug ? toTitleCase(slug) : "";
// }
// // function formatText(slug) {
// //   return slug ? slug.replace(/-/g, " ") : "";
// // }

// // Debounce
// function debounce(fn, delay = 250) {
//   let t;
//   return (...args) => {
//     clearTimeout(t);
//     t = setTimeout(() => fn.apply(this, args), delay);
//   };
// }

// // Normalize (safe lower-case)
// function norm(s) {
//   return (s || "").toLowerCase();
// }

// // ====== Build Prefix Index (ultra-fast) ======
// function buildIndex(data) {
//   prefixMap.clear();

//   data.forEach(item => {
//     const name = norm(item.city);

//     // build prefixes: "r", "ra", "rai", ...
//     for (let i = 1; i <= name.length; i++) {
//       const p = name.slice(0, i);
//       if (!prefixMap.has(p)) prefixMap.set(p, []);
//       prefixMap.get(p).push(item);
//     }
//   });
// }

// // city Validate
// let citySet = new Set();

// function buildCitySet(data) {
//   data.forEach(item => {
//     const key = `${slugify(item.city)}-${slugify(item.state)}`; // already slug होना चाहिए
//     citySet.add(key);
//   });
// }

// // ====== Loader / States ======
// function showLoader(count = 5) {
//   suggestions.innerHTML = "";
//   noResults.style.display = "none";
//   loader.innerHTML = "";

//   for (let i = 0; i < count; i++) {
//     const div = document.createElement("div");
//     div.className = "loader-item";
//     loader.appendChild(div);
//   }
// }

// function hideLoader() {
//   loader.innerHTML = "";
// }

// function showNoResults() {
//   suggestions.innerHTML = "";
//   hideLoader();
//   noResults.style.display = "block";
// }

// // ====== Highlight ======
// function highlight(text, query) {
//   if (!query) return text;
//   const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//   const re = new RegExp(`(${safe})`, "gi");
//   return text.replace(re, "<mark>$1</mark>");
// }

// // ====== Render ======
// function showSuggestions(list, query) {
//   hideLoader();
//   noResults.style.display = "none";
//   suggestions.innerHTML = "";
//   currentFocus = -1;

//   list.forEach(item => {
//     const li = document.createElement("li");

//     li.innerHTML = `
//       <span class="city">${highlight(item.city, query)}</span>
//       <span class="state">${item.state}</span>
//     `;

//     li.addEventListener("click", () => {
//       input.value = `${item.city}, ${item.state}`;
//       // goToCity(item);
//       closeDropdown();
//     });

//     suggestions.appendChild(li);
//   });
// }

// // ====== Open / Close ======
// function openDropdown() {
//   dropdown.classList.remove("hidden");
// }

// function closeDropdown() {
//   dropdown.classList.add("hidden");
//   suggestions.innerHTML = "";
//   hideLoader();
//   noResults.style.display = "none";
//   currentFocus = -1;
// }

// // ====== Keyboard Nav ======
// function addActive(items) {
//   if (!items.length) return;

//   removeActive(items);

//   if (currentFocus >= items.length) currentFocus = 0;
//   if (currentFocus < 0) currentFocus = items.length - 1;

//   items[currentFocus].classList.add("active");
// }

// function removeActive(items) {
//   for (let i = 0; i < items.length; i++) {
//     items[i].classList.remove("active");
//   }
// }

// input.addEventListener("keydown", (e) => {
//   const items = suggestions.getElementsByTagName("li");

//   if (e.key === "ArrowDown") {
//     currentFocus++;
//     addActive(items);
//   } else if (e.key === "ArrowUp") {
//     currentFocus--;
//     addActive(items);
//   } else if (e.key === "Enter") {
//     e.preventDefault();
//     if (currentFocus > -1 && items[currentFocus]) {
//       items[currentFocus].click();
//     }
//   } else if (e.key === "Escape") {
//     closeDropdown();
//   }
// });

// // ====== Search (Hybrid: Prefix + Fuse) ======
// const handleSearch = debounce(() => {
//   const query = norm(input.value.trim());

//   if (!query) {
//     closeDropdown();
//     return;
//   }

//   openDropdown();

//   // predict count for loader (max 8)
//   let predicted = prefixMap.get(query)?.length || 5;
//   predicted = Math.min(predicted, 8);

//   showLoader(predicted);

//   // small delay for skeleton feel
//   setTimeout(() => {
//     let results = [];

//     // 1) Prefix (instant)
//     if (prefixMap.has(query)) {
//       results = prefixMap.get(query);
//     } else {
//       // 2) Fuzzy fallback
//       const r = fuse.search(query);
//       results = r.map(x => x.item);
//     }

//     if (!results.length) {
//       showNoResults();
//       return;
//     }

//     showSuggestions(results.slice(0, 8), query);
//   }, 150);

// }, 250);

// input.addEventListener("input", handleSearch);

// // ====== Outside click ======
// document.addEventListener("click", (e) => {
//   if (!e.target.closest(".search-box")) {
//     closeDropdown();
//   }
// });

// // ====== Init (fetch JSON + Fuse) ======
// fetch("https://vinku.in/data/cities.json")
//   .then(res => res.json())
//   .then(data => {
//     cities = data;

//     // build fast index
//     buildIndex(cities);
//     buildCitySet(cities);

//     // fuse setup
//     fuse = new Fuse(cities, {
//       keys: ["city", "state"],
//       threshold: 0.3,
//       ignoreLocation: true
//     });
//   })
//   .catch(err => {
//     console.error("Cities load error:", err);
//   });

// // Recent Search ==========================================================
// const MAX_ITEMS = 10;

// // Save search
// function saveSearch(city, state, category) {
//   if (!city && !category) return;

//   let searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

//   const newItem = {city, state, category}

//   // duplicate remove (same city+category)
//   searches = searches.filter(item => 
//     !(item.city === city && item.category === category)
//   );

//   // add new at top
//   searches.unshift(newItem);

//   // limit
//   searches = searches.slice(0, MAX_ITEMS);

//   localStorage.setItem("recentSearches", JSON.stringify(searches));
// }

// // Build Url
// function buildUrl(state, city, category) {
//   let url = "";

//   if (state && city && category) {
//     url = `/${state}/${city}/${category}/`;
//   } else if (state && city) {
//     url = `/${state}/${city}/`;
//   } else if (category) {
//     url = `/${category}/`;
//   } else {
//     url = `/`;
//   }

//   return url;
// }

// // Search City
// function searchCity() {

//   let input = document.getElementById("search").value.trim();
//   let category = document.getElementById("category").value;

//   let city = "";
//   let state = "";

//   // 👉 parse city/state (अगर input है)
//   if (input) {
//     let parts = input.split(",");

//     city = parts[0]?.trim() || "";
//     state = parts[1]?.trim() || "";
//   }

//   // 👉 slugify (हर case में)
//   city = slugify(city);
//   state = slugify(state);
//   category = slugify(category);

//   // =========================
//   // ✅ SAVE LOGIC (independent)
//   // =========================
//   // if (city || category) {
//     if (city || category) {
//       // 👉 अगर city है तो validate करो
//       if (city) {
    
//         if (citySet.size === 0) {
//           console.log("Cities अभी load नहीं हुई");
//         } 
//         else if (!isValidCity(city, state)) {
    
//           alert("City not found"); // 👈 alert दिखाओ
//           return; // 👉 गलत city पर redirect भी रोकना है
    
//         } 
//         else {
//           saveSearch(city, state, category); // ✅ valid city
//         }
    
//       } else {
//         // 👉 category only
//         saveSearch(city, state, category);
//       }
    
//     }
//   // }

//   // =========================
//   // ✅ REDIRECT LOGIC (separate)
//   // =========================
//   let url = buildUrl(state, city, category);

//   if (url) {
//     window.location.href = url;
//   }
// }

// // Show searches
// function loadRecentSearches() {

//   const container = document.getElementById("recent-container");
//   const wrapper = document.getElementById("recent-chips");

//   if (!container || !wrapper) return;

//   const searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

//   wrapper.innerHTML = "";

//   // 👉 UI show/hide
//   if (searches.length === 0) {
//     container.style.display = "none";
//     return;
//   } else {
//     container.style.display = "block";
//   }

//   searches.forEach(item => {

//     const chip = document.createElement("div");
//     chip.className = "chip";

//     const url = buildUrl(item.state, item.city, item.category);

//     // label बनाओ (clean)
//     const parts = [];

//     if (item.city) parts.push(formatText(item.city));
//     if (item.state) parts.push(formatText(item.state));

//     let label = parts.join(", ");

//     if (item.category) {
//       const cat = toTitleCase(item.category);
//       label = label ? `${label} ${cat}` : cat;
//     }

//     chip.innerText = label;

//     chip.onclick = () => {
//       window.location.href = url;
//     };

//     wrapper.appendChild(chip);
//   });
// }

// // Reset Recent Search
// function clearRecent() {
//   localStorage.removeItem("recentSearches");
//   loadRecentSearches();
// }

// // Load Recent Searches on page load
// document.addEventListener("DOMContentLoaded", loadRecentSearches);
