/* CargoOpt — Enhanced Frontend with Truck Animations */

let items = [];
let rowId  = 0;

// ── Toast ─────────────────────────────────────────
function toast(msg, type = "info") {
  const tc = document.getElementById("toastContainer");
  const t  = document.createElement("div");
  const icons = { error:"✖", success:"✔", info:"ℹ" };
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span>${icons[type]||"ℹ"}</span>${msg}`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function updateCounter() {
  document.getElementById("itemCounter").textContent =
    `${items.length} item${items.length !== 1 ? "s" : ""}`;
}

// ── Truck Animations ──────────────────────────────
function truckIdle() {
  const scene = document.getElementById("roadScene");
  scene.className = "road-scene idle";
}

function truckDrive() {
  const scene = document.getElementById("roadScene");
  scene.className = "road-scene driving";
}

function truckArrive(withCargo) {
  const scene = document.getElementById("roadScene");
  scene.className = "road-scene arrived";
  if (withCargo) {
    setTimeout(() => {
      document.getElementById("cargoBoxes").style.opacity = "1";
    }, 300);
  }
}

function truckReset() {
  // Snap truck offscreen, then go idle
  const scene = document.getElementById("roadScene");
  scene.className = "road-scene";
  document.getElementById("cargoBoxes").style.opacity = "0";
  setTimeout(() => truckIdle(), 80);
}

// On page load show truck parked
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => truckIdle(), 200);
});

// ── Add Item ──────────────────────────────────────
function addItem() {
  const name   = document.getElementById("itemName").value.trim();
  const weight = parseInt(document.getElementById("itemWeight").value);
  const profit = parseInt(document.getElementById("itemProfit").value);

  if (!name)                        return toast("Please enter an item name.", "error");
  if (isNaN(weight) || weight <= 0) return toast("Weight must be a positive integer.", "error");
  if (isNaN(profit) || profit <= 0) return toast("Value must be a positive integer.", "error");

  const id = ++rowId;
  items.push({ id, name, weight, profit });
  renderRow({ id, name, weight, profit });

  document.getElementById("itemName").value   = "";
  document.getElementById("itemWeight").value = "";
  document.getElementById("itemProfit").value = "";
  document.getElementById("itemName").focus();
  document.getElementById("emptyRow").style.display = "none";
  updateCounter();
  toast(`"${name}" added.`, "success");
}

function renderRow(item) {
  const tbody = document.getElementById("cargoBody");
  const idx   = items.findIndex(i => i.id === item.id) + 1;
  const tr    = document.createElement("tr");
  tr.id        = `row-${item.id}`;
  tr.className = "row-new";
  tr.innerHTML = `
    <td class="td-num">${idx}</td>
    <td class="td-name">${escHtml(item.name)}</td>
    <td class="td-weight">${item.weight} kg</td>
    <td class="td-profit">₹${item.profit}</td>
    <td>
      <button class="btn btn-del" title="Remove" onclick="deleteItem(${item.id})">
        <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
          <path d="M2 4h12v1.5H2zm2.5 0V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4m-6 2v7h7V6m-4 2v4m2-4v4" stroke="currentColor" stroke-width="0.5" fill="none"/>
          <path d="M5 4V3h6v1"/>
        </svg>
      </button>
    </td>`;
  tbody.appendChild(tr);
}

function deleteItem(id) {
  items = items.filter(i => i.id !== id);
  const row = document.getElementById(`row-${id}`);
  if (row) { row.style.opacity = "0"; row.style.transform = "translateX(12px)"; row.style.transition = "all .2s"; setTimeout(() => row.remove(), 200); }
  setTimeout(() => renumberRows(), 220);
  updateCounter();
  if (items.length === 0) document.getElementById("emptyRow").style.display = "";
}

function renumberRows() {
  items.forEach((item, idx) => {
    const row = document.getElementById(`row-${item.id}`);
    if (row) row.querySelector(".td-num").textContent = idx + 1;
  });
}

function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Optimize ──────────────────────────────────────
async function optimize() {
  const capacity = parseInt(document.getElementById("capacity").value);
  if (isNaN(capacity) || capacity <= 0) return toast("Enter a valid vehicle capacity.", "error");
  if (items.length === 0)               return toast("Add at least one cargo item first.", "error");

  // Start truck driving
  truckDrive();
  document.getElementById("optimizeBtn").disabled = true;

  setLoading(true);
  hideResults();

  // Animate loading stages
  const stageTimings = [0, 700, 1400, 1900];
  const stageIds = ["stage1","stage2","stage3","stage4"];
  stageIds.forEach(id => document.getElementById(id).className = "stage");
  document.getElementById("stage1").className = "stage active";

  const stageTimers = stageTimings.slice(1).map((ms, i) =>
    setTimeout(() => {
      document.getElementById(stageIds[i]).className = "stage done";
      document.getElementById(stageIds[i+1]).className = "stage active";
    }, ms)
  );

  try {
    const res  = await fetch("/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ items, capacity })
    });
    stageTimers.forEach(clearTimeout);

    const data = await res.json();
    if (!res.ok) {
      toast(data.error || "Server error.", "error");
      setLoading(false);
      document.getElementById("optimizeBtn").disabled = false;
      truckIdle();
      return;
    }

    // Mark all stages done
    stageIds.forEach(id => document.getElementById(id).className = "stage done");

    setTimeout(() => {
      setLoading(false);
      // Truck arrives with cargo
      truckArrive(true);
      showResults(data, capacity);
      if (data.dp_table && data.dp_table.length) renderDpTable(data.dp_table, items, capacity);
      document.getElementById("optimizeBtn").disabled = false;
    }, 500);

  } catch (err) {
    stageTimers.forEach(clearTimeout);
    setLoading(false);
    toast("Network error — is Flask running?", "error");
    document.getElementById("optimizeBtn").disabled = false;
    truckIdle();
    console.error(err);
  }
}

// ── UI State ──────────────────────────────────────
function setLoading(on) {
  document.getElementById("loaderWrap").style.display       = on ? "" : "none";
  document.getElementById("resultPlaceholder").style.display = on ? "none" : "";
}

function hideResults() {
  document.getElementById("resultContent").style.display = "none";
  document.getElementById("dpSection").style.display     = "none";
  document.getElementById("resultPlaceholder").style.display = "none";
}

function showResults(data, capacity) {
  document.getElementById("resultPlaceholder").style.display = "none";
  document.getElementById("resultContent").style.display     = "";

  // Animate stat numbers counting up
  animateNumber("statProfit", 0, data.max_profit, 1200, v => `₹${v}`);
  document.getElementById("statWeight").textContent = `${data.total_weight}/${capacity} kg`;
  animateNumber("statItems", 0, data.selected_items.length, 800, v => `${v}`);

  const pct = Math.round((data.total_weight / capacity) * 100);
  document.getElementById("capPct").textContent = `${pct}%`;
  setTimeout(() => { document.getElementById("capacityFill").style.width = `${pct}%`; }, 100);

  const list = document.getElementById("selectedList");
  list.innerHTML = "";
  data.selected_items.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "sel-item";
    div.style.animationDelay = `${i * 100}ms`;
    div.innerHTML = `
      <span class="sel-dot"></span>
      <span class="sel-name">${escHtml(item.name)}</span>
      <span class="sel-meta">${item.weight}kg · <span>₹${item.profit}</span></span>`;
    list.appendChild(div);
  });

  toast(`Optimization complete — ₹${data.max_profit} max value!`, "success");
}

function animateNumber(id, from, to, duration, fmt) {
  const el = document.getElementById(id);
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(Math.round(from + (to - from) * ease));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── DP Table ──────────────────────────────────────
function renderDpTable(dpTable, allItems, capacity) {
  const section = document.getElementById("dpSection");
  const wrap    = document.getElementById("dpTableWrap");
  section.style.display = "";

  const cols = dpTable[0].length;
  const rows = dpTable.length;

  let html = `<table class="dp-table"><thead><tr><th>Item \\ W</th>`;
  for (let j = 0; j < cols; j++) html += `<th>${j}</th>`;
  html += `</tr></thead><tbody>`;

  for (let i = 0; i < rows; i++) {
    const label = i === 0 ? "∅" : (allItems[i-1] ? allItems[i-1].name.substring(0,8) : `I${i}`);
    html += `<tr><th>${escHtml(label)}</th>`;
    for (let j = 0; j < cols; j++) {
      const val  = dpTable[i][j];
      const prev = i > 0 ? dpTable[i-1][j] : 0;
      const cls  = val > prev ? " dp-cell-highlight" : "";
      html += `<td class="${cls}">${val}</td>`;
    }
    html += `</tr>`;
  }
  html += `</tbody></table>`;
  wrap.innerHTML = html;
}

// ── Keyboard shortcuts ────────────────────────────
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && ["itemName","itemWeight","itemProfit"].includes(document.activeElement.id)) addItem();
});
