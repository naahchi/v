// ====== Elements ======
const input = document.getElementById("search");
const dropdown = document.getElementById("dropdown");
const suggestions = document.getElementById("suggestions");
const loader = document.getElementById("loader");
const noResults = document.getElementById("noResults");

// ====== State ======
let cities = [];
let fuse = null;
let prefixMap = new Map();
let currentFocus = -1;

// ====== slugify ======
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}
// Format Text
function formatText(slug) {
  return slug ? slug.replace(/-/g, " ") : "";
}

// Debounce
function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Normalize (safe lower-case)
function norm(s) {
  return (s || "").toLowerCase();
}

// ====== Build Prefix Index (ultra-fast) ======
function buildIndex(data) {
  prefixMap.clear();

  data.forEach(item => {
    const name = norm(item.city);

    // build prefixes: "r", "ra", "rai", ...
    for (let i = 1; i <= name.length; i++) {
      const p = name.slice(0, i);
      if (!prefixMap.has(p)) prefixMap.set(p, []);
      prefixMap.get(p).push(item);
    }
  });
}

// ====== Loader / States ======
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

// ====== Highlight ======
function highlight(text, query) {
  if (!query) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${safe})`, "gi");
  return text.replace(re, "<mark>$1</mark>");
}

// ====== Render ======
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

    li.addEventListener("click", () => {
      input.value = `${item.city}, ${item.state}`;
      // goToCity(item);
      closeDropdown();
    });

    suggestions.appendChild(li);
  });
}

// ====== Open / Close ======
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

// ====== Keyboard Nav ======
function addActive(items) {
  if (!items.length) return;

  removeActive(items);

  if (currentFocus >= items.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = items.length - 1;

  items[currentFocus].classList.add("active");
}

function removeActive(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].classList.remove("active");
  }
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

// ====== Search (Hybrid: Prefix + Fuse) ======
const handleSearch = debounce(() => {
  const query = norm(input.value.trim());

  if (!query) {
    closeDropdown();
    return;
  }

  openDropdown();

  // predict count for loader (max 8)
  let predicted = prefixMap.get(query)?.length || 5;
  predicted = Math.min(predicted, 8);

  showLoader(predicted);

  // small delay for skeleton feel
  setTimeout(() => {
    let results = [];

    // 1) Prefix (instant)
    if (prefixMap.has(query)) {
      results = prefixMap.get(query);
    } else {
      // 2) Fuzzy fallback
      const r = fuse.search(query);
      results = r.map(x => x.item);
    }

    if (!results.length) {
      showNoResults();
      return;
    }

    showSuggestions(results.slice(0, 8), query);
  }, 150);

}, 250);

input.addEventListener("input", handleSearch);

// ====== Outside click ======
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-box")) {
    closeDropdown();
  }
});

// ====== Init (fetch JSON + Fuse) ======
fetch("https://vinku.in/data/cities.json")
  .then(res => res.json())
  .then(data => {
    cities = data;

    // build fast index
    buildIndex(cities);

    // fuse setup
    fuse = new Fuse(cities, {
      keys: ["city", "state"],
      threshold: 0.3,
      ignoreLocation: true
    });
  })
  .catch(err => {
    console.error("Cities load error:", err);
  });

// Recent Search ==========================================================
const MAX_ITEMS = 5;

// Save search
function saveSearch(city, state, category) {
  if (!city || !category) return;

  let searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

  const newItem = {city, state, category}

  // duplicate remove (same city+category)
  searches = searches.filter(item => 
    !(item.city === city && item.category === category)
  );

  // add new at top
  searches.unshift(newItem);

  // limit
  searches = searches.slice(0, MAX_ITEMS);

  localStorage.setItem("recentSearches", JSON.stringify(searches));
}

// Build Url
function buildUrl(state, city, category) {
  let url = "";

  if (state && city && category) {
    url = `/${state}/${city}/${category}/`;
  } else if (state && city) {
    url = `/${state}/${city}/`;
  } else if (category) {
    url = `/${category}/`;
  }

  return url;
}

// Search City
function searchCity() {
  let input = document.getElementById("search").value.trim();
  let category = document.getElementById("category").value;

  let city = "";
  let state = "";

  if (input || category) {

    let parts = input.split(",");
    city = parts[0]?.trim().toLowerCase();
    state = parts[1]?.trim().toLowerCase();

    city = slugify(city);
    state = slugify(state);
    category = slugify(category);

    saveSearch(city, state, category); // Save to recent searches
  }

  let url = "";

  // ✅ case 1: city + state + category
  if (city && state && category) {
    url = `/${state}/${city}/${category}/`;
  }
  // ✅ case 2: only city
  else if (city && state) {
    url = `/${state}/${city}/`;
  }
  // ✅ case 3: only category (IMPORTANT FIX)
  else if (category) {
    url = `/${category}/`;
  }
  // ❌ nothing selected
  else {
    url = `/`;
    // alert("Please select something");
    // return;
  }

  window.location.href = url;
}

// Show searches
function loadRecentSearches() {
  const list = document.getElementById("recentSearches");
  if (!list) return;

  const searches = JSON.parse(localStorage.getItem("recentSearches")) || [];

  list.innerHTML = "";

  searches.forEach(item => {
    const li = document.createElement("li");

    const url = buildUrl(item.state, item.city, item.category);

    const label = `${formatText(item.city)}, ${formatText(item.state)} ${formatText(item.category)}`;

    li.innerHTML = `<a href="${url}">${label}</a>`;
    list.appendChild(li);
  });

  
  // searches.forEach(item => {
  //   const li = document.createElement("li");
  
  //   const url = buildUrl(item.state, item.city, item.category);
  
  //   const labelParts = [];
  
  //   if (item.city) labelParts.push(formatText(item.city));
  //   if (item.state) labelParts.push(formatText(item.state));
  
  //   let label = labelParts.join(", ");
  
  //   if (item.category) {
  //     label += label ? `${formatText(item.category)}` : formatText(item.category);
  //   }
  
  //   li.innerHTML = `<a href="${url}">${label}</a>`;
  //   list.appendChild(li);
  // });
  
}

// Load Recent Searches on page load
document.addEventListener("DOMContentLoaded", loadRecentSearches);
