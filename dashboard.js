/* =========================================================
   ✅ CLEAN DASHBOARD JS (Reduced size, Mongo-based)
   Keeps: booking + customer + docs + payments + rooms + staff
         + attendance + food orders
   ========================================================= */

/* -------------------- CONFIG -------------------- */

(async function protectPage() {
  const sessionId = localStorage.getItem("sessionId");

  if (!sessionId) {
    window.location.href = "login.html";
    return;
  }

  try {
    const res = await fetch("https://saigangahotelmanagement-some-changes.onrender.com/api/verify-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId })
    });

    const data = await res.json();
    if (!data.valid) {
      localStorage.removeItem("sessionId");
      window.location.href = "login.html";
    }
  } catch (err) {
    localStorage.removeItem("sessionId");
    window.location.href = "login.html";
  }
})();



const API_URL = "https://saigangahotelmanagement-some-changes.onrender.com/newapi";
const HOTEL_ADDRESS = `ADDRESS: NAGAR, SHRIDI ROAD, GUHA, TALUKA RAHURI,
DIST: AHILYANAGAR, STATE: MAHARASHTRA, PINCODE: 413706`;

/* -------------------- STATE -------------------- */
const rooms = { first: [], second: [], third: [] };
let bookings = [],
  customers = [],
  payments = [],
  staff = [],
  attendance = [];
let selectedRooms = [];
let bookingCounter = 1;

let foodItems = [];
let filteredFoodItems = [];
let foodOrder = {};
let currentBookingForFood = null;

let currentTheme = "light";
let currentAttendanceMonth = new Date();
let currentAttendanceView = "calendar";

/* -------------------- HELPERS -------------------- */

function time12(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function dateGB(dateObj = new Date()) {
  return dateObj.toLocaleDateString("en-GB"); // DD/MM/YYYY
}



function $(id) {
  return document.getElementById(id);
}

function getList(json) {
  if (Array.isArray(json)) return json;
  return (
    json.items ||
    json.data ||
    json.rooms ||
    json.bookings ||
    json.customers ||
    json.payments ||
    json.attendance ||
    json.staff ||
    []
  );
}

function calculateNights(checkInISO, checkOutISO) {
  if (!checkInISO || !checkOutISO) return 1;
  const start = new Date(checkInISO);
  const end = new Date(checkOutISO);
  const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
  return diffDays || 1;
}

function toISODateKeyFromGB(gbDate) {
  // "DD/MM/YYYY" -> "YYYY-MM-DD"
  if (!gbDate || !gbDate.includes("/")) return "";
  const [dd, mm, yyyy] = gbDate.split("/");
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function toGBDateFromISO(isoDate) {
  // "YYYY-MM-DD" -> "DD/MM/YYYY"
  if (!isoDate || !isoDate.includes("-")) return "";
  const [yyyy, mm, dd] = isoDate.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

/* -------------------- NORMALIZERS -------------------- */
const normalizeRoom = (r) => ({
  floor: String(r.floor || "").toLowerCase(),
  number: String(r.roomNumber || ""),
  status: String(r.status || "available").toLowerCase(),
  price: Number(r.price || 0),
  type: r.type || "",
});

const normalizeBooking = (b) => ({
  bookingId: b.bookingId || "",
  customerName: b.customerName || "",
  mobile: b.mobile || "",
  roomNumbers: Array.isArray(b.roomNumbers) ? b.roomNumbers.map(String) : [],
  status: b.status || "",
  checkInDate: b.checkInDate || "",
  checkInTime: b.checkInTime || "",
  checkOutDate: b.checkOutDate || "",
  nights: Number(b.nights || 1),
  roomPricePerNight: Number(b.roomPricePerNight || 0),
  roomAmount: Number(b.roomAmount || 0),
  additionalAmount: Number(b.additionalAmount || 0),
  totalAmount: Number(b.totalAmount || 0),
  advance: Number(b.advance || 0),
  balance: Number(b.balance || 0),

  // ✅ MUST ADD THIS
  raw: b.raw || {},
  foodOrders: Array.isArray(b.foodOrders) ? b.foodOrders : [],
});

const normalizeCustomer = (c) => ({
  customerId: c.customerId || "",
  name: c.name || "",
  mobile: c.mobile || "",
  address: c.address || "",
  totalBookings: Number(c.totalBookings || 0),
  documents: Array.isArray(c.documents) ? c.documents : [],
});

const normalizePayment = (p) => ({
  paymentId: p.paymentId || "",
  bookingId: p.bookingId || "",
  customerName: p.customerName || "",
  amount: Number(p.amount || 0),
  paymentMode: p.paymentMode || "",
  date: p.date || "",
  time: p.time || "",
});

const normalizeAttendance = (a) => ({
  attendanceId: a.attendanceId || "",
  staffId: a.staffId || "",
  staffName: a.staffName || "",
  date: a.date || "",
  time: a.time || "",
  status: a.status || "Present",
});

/* -------------------- THEME -------------------- */
function toggleTheme() {
  const body = document.body;
  const themeIcon = $("themeIcon");
  if (currentTheme === "light") {
    body.classList.add("dark-theme");
    if (themeIcon) themeIcon.textContent = "☀️";
    currentTheme = "dark";
    localStorage.setItem("theme", "dark");
  } else {
    body.classList.remove("dark-theme");
    if (themeIcon) themeIcon.textContent = "🌙";
    currentTheme = "light";
    localStorage.setItem("theme", "light");
  }
}

function loadTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark-theme");
    const themeIcon = $("themeIcon");
    if (themeIcon) themeIcon.textContent = "☀️";
    currentTheme = "dark";
  }
}

/* =========================================================
   ✅ DATA LOADING
   ========================================================= */
async function loadFoodItemsFromServer() {
  
  try {
    const res = await fetch(`${API_URL}/food`);
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.error || "Failed to load food");

    foodItems = (data.items || []).map((x) => ({
      id: x.foodId,
      name: x.name,
      price: Number(x.price || 0),
      isAvailable: x.isAvailable !== false,
      category: x.category || "General",
    }));

    filteredFoodItems = [...foodItems];
  } catch (err) {
    console.error("❌ loadFoodItemsFromServer:", err);
    foodItems = [];
    filteredFoodItems = [];
  }
  searchFoodMenu()
}

async function loadAllData() {
  try {
    const [
      roomsJson,
      bookingsJson,
      customersJson,
      paymentsJson,
      staffJson,
      attJson,
    ] = await Promise.all([
      fetch(`${API_URL}/rooms`).then((r) => r.json()),
      fetch(`${API_URL}/bookings`).then((r) => r.json()),
      fetch(`${API_URL}/customers`).then((r) => r.json()),
      fetch(`${API_URL}/payments`).then((r) => r.json()),
      fetch(`${API_URL}/staff`).then((r) => r.json()),
      fetch(`${API_URL}/attendance`).then((r) => r.json()),
    ]);

    const roomList = getList(roomsJson).map(normalizeRoom);
    rooms.first = roomList.filter((r) => r.floor === "first");
    rooms.second = roomList.filter((r) => r.floor === "second");
    rooms.third = roomList.filter((r) => r.floor === "third");

    bookings = getList(bookingsJson).map(normalizeBooking);
    customers = getList(customersJson).map(normalizeCustomer);
    payments = getList(paymentsJson).map(normalizePayment);
    staff = staffJson.items || staffJson || [];
    attendance = getList(attJson).map(normalizeAttendance);

    // bookingCounter
    const ids = bookings
      .map((b) => parseInt(String(b.bookingId).replace("BK", ""), 10))
      .filter((n) => !isNaN(n));
    bookingCounter = ids.length ? Math.max(...ids) + 1 : 1;

    updateRoomstatusFromBookings();
    initializeRooms();
    updateDashboard();
    updateAllTables();
    updateStaffTable();
    showRoomStatus();

  } catch (err) {
    console.error("❌ loadAllData:", err);
    alert("⚠️ Server connection failed. Check backend is running.");
  }
}

/* =========================================================
   ✅ ROOMS (selection + admin)
   ========================================================= */
function updateRoomstatusFromBookings() {
  const confirmed = bookings.filter((b) => b.status === "Confirmed");
  // reset to available first (based on DB)
  // NOTE: DB should be truth, but this keeps UI consistent
  [rooms.first, rooms.second, rooms.third].forEach((list) => {
    list.forEach((r) => (r.status = String(r.status || "available").toLowerCase()));
  });

  confirmed.forEach((b) => {
    (b.roomNumbers || []).forEach((roomNum) => {
      const all = [...rooms.first, ...rooms.second, ...rooms.third];
      const room = all.find((r) => String(r.number) === String(roomNum));
      if (room) room.status = "occupied";
    });
  });
}

function initializeRooms() {
  renderRoomBoxes("firstFloor", rooms.first);
  renderRoomBoxes("secondFloor", rooms.second);
  renderRoomBoxes("thirdFloor", rooms.third);
  renderRoomstatus();
}

function renderRoomBoxes(containerId, roomList) {
  const container = $(containerId);
  if (!container) return;

  container.innerHTML = "";
  roomList.forEach((room) => {
    const box = document.createElement("div");
    const statusClass = String(room.status || "available").toLowerCase();
    box.className = `room-box ${statusClass}`;
    box.innerHTML = `${room.number}<br><small>${room.type || ""}</small>`;

    if (statusClass === "available") box.onclick = () => selectRoom(room, box);
    container.appendChild(box);
  });
}

function selectRoom(room, boxElement) {
  const idx = selectedRooms.findIndex((r) => r.number === room.number);
  if (idx !== -1) {
    selectedRooms.splice(idx, 1);
    boxElement.classList.remove("selected");
  } else {
    selectedRooms.push(room);
    boxElement.classList.add("selected");
  }
  updateSelectedRoomsList();
}

function updateSelectedRoomsList() {
  const el = $("selectedRoomsList");
  if (!el) return;

  if (!selectedRooms.length) {
    el.textContent = "None";
    el.style.color = "#e74c3c";
  } else {
    el.textContent = selectedRooms.map((r) => `${r.number} (${r.type})`).join(", ");
    el.style.color = "#27ae60";
  }
}

function renderRoomstatus() {
  const container = $("roomsstatus");
  if (!container) return;

  const floors = [
    { name: "First Floor", rooms: rooms.first },
    { name: "Second Floor", rooms: rooms.second },
    { name: "Third Floor", rooms: rooms.third },
  ];

  container.innerHTML = floors
    .map(
      (f) => `
      <div class="floor-section">
        <div class="floor-title">${f.name}</div>
        <div class="room-selector">
          ${(f.rooms || [])
            .map(
              (r) => `
              <div class="room-box ${r.status}">
                ${r.number}<br><small>${r.type || ""}</small><br>
                <small style="text-transform: capitalize;">${r.status}</small>
              </div>
            `
            )
            .join("")}
        </div>
      </div>
    `
    )
    .join("");
}

/* -------- Admin Room Status CRUD UI -------- */
function showRoomStatus() {
  const container = $("roomStatusContainer");
  if (!container) return;

  const floors = [
    { title: "First Floor", list: rooms.first },
    { title: "Second Floor", list: rooms.second },
    { title: "Third Floor", list: rooms.third },
  ];

  let html = `
    <div class="card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
        <div>
          <h2>🛏️ Room Status (Admin)</h2>
          <div style="font-size:12px;color:#7f8c8d;">Add / Edit / Delete rooms</div>
        </div>
        <button class="btn btn-success" onclick="openAddRoomModal()">+ Add Room</button>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;margin:15px 0;flex-wrap:wrap;">
        <span class="badge" style="background:#2ecc71;color:white;">available</span>
        <span class="badge" style="background:#e74c3c;color:white;">occupied</span>
      </div>
  `;

  floors.forEach((f) => {
    html += `<h3 style="margin:15px 0 8px;color:#2c3e50;">${f.title}</h3>`;
    html += `<div class="room-selector" style="display:flex;flex-wrap:wrap;gap:10px;">`;

    if (!f.list?.length) html += `<div style="color:#7f8c8d;padding:10px;">No rooms</div>`;
    else {
      f.list.forEach((r) => {
        const status = String(r.status || "available").toLowerCase();
        html += `
          <div class="room-box ${status}" style="cursor:default; min-width:110px;">
            <div style="font-weight:800;font-size:16px;">${r.number}</div>
            <small>${r.type || "-"}</small><br/>
            <small style="text-transform:capitalize;">${status}</small>
            <div style="display:flex;gap:6px;justify-content:center;margin-top:8px;">
              <button class="action-btn btn-warning" style="padding:4px 8px;font-size:10px;"
                onclick="openEditRoomModal('${r.number}')">✏️</button>
              <button class="action-btn btn-danger" style="padding:4px 8px;font-size:10px;"
                onclick="deleteRoom('${r.number}', '${status}')">🗑️</button>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;
  });

  html += `
    </div>

    <div id="roomModal" class="modal">
      <div class="modal-content" style="max-width:520px;">
        <div class="modal-header">
          <h2 id="roomModalTitle">Add Room</h2>
          <span class="close-btn" onclick="closeRoomModal()">×</span>
        </div>

        <form onsubmit="return handleRoomSubmit(event)">
          <input type="hidden" id="roomMode" value="add" />

          <div class="form-group">
            <label>Room Number *</label>
            <input type="text" id="roomNumberInput" required />
          </div>

          <div class="form-group">
            <label>Floor</label>
            <select id="roomFloorInput">
              <option value="first">first</option>
              <option value="second">second</option>
              <option value="third">third</option>
            </select>
          </div>

          <div class="form-group">
            <label>Type</label>
            <input type="text" id="roomTypeInput" placeholder="Non AC / AC" />
          </div>

          <div class="form-group">
            <label>Price</label>
            <input type="number" id="roomPriceInput" min="0" value="0" />
          </div>

          <div class="form-group">
            <label>Status</label>
            <select id="roomStatusInput">
              <option value="available">available</option>
              <option value="occupied">occupied</option>
            </select>
          </div>

          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">
            <button type="button" class="btn btn-danger" onclick="closeRoomModal()">Cancel</button>
            <button type="submit" class="btn btn-success">✅ Save</button>
          </div>
        </form>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function openAddRoomModal() {
  $("roomModalTitle").textContent = "Add Room";
  $("roomMode").value = "add";
  const num = $("roomNumberInput");
  num.value = "";
  num.disabled = false;
  $("roomFloorInput").value = "first";
  $("roomTypeInput").value = "";
  $("roomPriceInput").value = 0;
  $("roomStatusInput").value = "available";
  $("roomModal").classList.add("active");
}

function openEditRoomModal(roomNumber) {
  const all = [...rooms.first, ...rooms.second, ...rooms.third];
  const r = all.find((x) => String(x.number) === String(roomNumber));
  if (!r) return alert("Room not found, reload data");

  $("roomModalTitle").textContent = "Edit Room";
  $("roomMode").value = "edit";
  const num = $("roomNumberInput");
  num.value = r.number;
  num.disabled = true;

  $("roomFloorInput").value = r.floor || "first";
  $("roomTypeInput").value = r.type || "";
  $("roomPriceInput").value = Number(r.price || 0);
  $("roomStatusInput").value = String(r.status || "available").toLowerCase();
  $("roomModal").classList.add("active");
}

function closeRoomModal() {
  const m = $("roomModal");
  if (m) m.classList.remove("active");
}

async function handleRoomSubmit(e) {
  e.preventDefault();
  const mode = $("roomMode").value; // add/edit
  const roomNumber = $("roomNumberInput").value.trim();

  const payload = {
    roomNumber,
    floor: $("roomFloorInput").value,
    type: $("roomTypeInput").value,
    price: Number($("roomPriceInput").value || 0),
    status: $("roomStatusInput").value,
  };

  if (!payload.roomNumber) return alert("Room number required");

  try {
    const url =
      mode === "add"
        ? `${API_URL}/rooms`
        : `${API_URL}/rooms/${encodeURIComponent(roomNumber)}`;

    const res = await fetch(url, {
      method: mode === "add" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Save failed");

    alert(mode === "add" ? "✅ Room added!" : "✅ Room updated!");
    closeRoomModal();
    await loadAllData();
  } catch (err) {
    console.error("❌ handleRoomSubmit:", err);
    alert("❌ " + err.message);
  }
  return false;
}

async function deleteRoom(roomNumber, status) {
  if (String(status).toLowerCase() === "occupied") {
    alert("⚠️ This room is occupied. Checkout booking first.");
    return;
  }
  if (!confirm(`Delete room ${roomNumber}?`)) return;

  try {
    const res = await fetch(`${API_URL}/rooms/${encodeURIComponent(roomNumber)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
    alert("✅ Room deleted!");
    await loadAllData();
  } catch (err) {
    console.error("❌ deleteRoom:", err);
    alert("❌ " + err.message);
  }
}

function openAddFoodItemModal() {
    document.getElementById('foodModalTitle').textContent = 'Add Food Item';
    document.getElementById('foodItemForm').reset();
    document.getElementById('foodItemId').value = '';
    currentEditingFoodItem = null;
    document.getElementById('foodItemModal').classList.add('active');
}
function closeFoodItemModal() {
    document.getElementById('foodItemModal').classList.remove('active');
}
function editFoodItem(foodId) {
  const item = foodItems.find(i => i.id === foodId);
  if (!item) return;

  document.getElementById('foodModalTitle').textContent = 'Edit Food Item';
  document.getElementById('foodItemId').value = item.id; // FOOD0001
  document.getElementById('foodItemName').value = item.name;
  document.getElementById('foodItemPrice').value = item.price;

  document.getElementById('foodItemModal').classList.add('active');
}
/* =========================================================
   ✅ DOCUMENT UPLOAD + VIEW
   ========================================================= */
function renderDocsRows(numPersons) {
  const container = $("docsContainer");
  if (!container) return;

  const n = Math.max(1, Number(numPersons || 1));

  let html = `
    <div style="margin: 20px 0; padding: 20px; border: 2px dashed #3498db; border-radius: 8px; background: #f0f8ff;">
      <h3 style="margin-bottom: 15px; color: #2c3e50;">📎 Upload Documents</h3>
  `;

  for (let i = 1; i <= n; i++) {
    html += `
      <div class="form-row">
        <div class="form-group">
          <label>Person ${i} - Aadhar Front</label>
          <input type="file" data-doc="1" data-person="${i}" data-side="front"
                 accept="image/*,.pdf" onchange="displayFileNameForDynamic(this)" />
          <small class="fileName" style="display:block;margin-top:5px;color:#27ae60;"></small>
        </div>

        <div class="form-group">
          <label>Person ${i} - Aadhar Back</label>
          <input type="file" data-doc="1" data-person="${i}" data-side="back"
                 accept="image/*,.pdf" onchange="displayFileNameForDynamic(this)" />
          <small class="fileName" style="display:block;margin-top:5px;color:#27ae60;"></small>
        </div>
      </div>
    `;
  }

  html += `
      <small style="display:block;margin-top:10px;color:#666;text-align:center;">
        📄 Accepted formats: Images (JPG, PNG) or PDF | Max size per file: 5MB
      </small>
    </div>
  `;

  container.innerHTML = html;
}

function displayFileNameForDynamic(input) {
  const small = input.parentElement.querySelector(".fileName");
  if (!small) return;

  const file = input.files && input.files[0];
  if (!file) return;

  const fileSize = (file.size / 1024 / 1024).toFixed(2);
  if (file.size > 5 * 1024 * 1024) {
    small.textContent = "❌ File too large (max 5MB)";
    small.style.color = "#e74c3c";
    input.value = "";
    return;
  }

  small.textContent = `✅ ${file.name} (${fileSize} MB)`;
  small.style.color = "#27ae60";
}

async function uploadDocuments(customerId, bookingId) {
  const fileInputs = Array.from(document.querySelectorAll("input[type='file'][data-doc]"));

  const formData = new FormData();
  formData.append("customerId", customerId);
  formData.append("bookingId", bookingId);

  let count = 0;

  for (const input of fileInputs) {
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const personIndex = input.getAttribute("data-person") || "1";
      const side = input.getAttribute("data-side") || "front";

      const newName = `p${personIndex}_${side}_${file.name}`;
      const renamedFile = new File([file], newName, { type: file.type });

      formData.append("documents", renamedFile);
      count++;
    }
  }

  if (!count) return [];

  const res = await fetch(`${API_URL}/customerDocuments/upload`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || "Upload failed");

  return data.documents || [];
}

async function viewCustomerDocuments(customerId) {
  try {
    const customer = customers.find((c) => String(c.customerId) === String(customerId));
    if (!customer) return alert("❌ Customer not found. Please reload data.");

    const docs = Array.isArray(customer.documents) ? customer.documents : [];
    if (!docs.length) return alert("📄 No documents uploaded for this customer.");

    const modal = document.createElement("div");
    modal.className = "modal active";

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 750px;">
        <div class="modal-header">
          <h2>📄 Customer Documents</h2>
          <span class="close-btn" onclick="this.closest('.modal').remove()">×</span>
        </div>

        <div style="margin: 20px 0;">
          <p><strong>Customer:</strong> ${customer.name || "-"}</p>
          <p><strong>Mobile:</strong> ${customer.mobile || "-"}</p>

          <h3 style="margin-top: 20px;">Uploaded Documents:</h3>

          <div style="max-height: 420px; overflow-y: auto;">
            ${docs
              .map((doc, i) => {
                const url = doc.url || "";
                const name = doc.originalName || doc.filename || `Document ${i + 1}`;
                const uploadedAt = doc.uploadedAt || doc.createdAt;

                const isImage =
                  url && /\.(jpg|jpeg|png|webp|gif)$/i.test(url);

                return `
                  <div style="padding: 12px; margin: 10px 0; background: #f8f9fa; border-radius: 8px;">
                    <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                      <div>
                        <strong>${i + 1}. ${name}</strong><br>
                        <small style="color:#666;">
                          ${uploadedAt ? `Uploaded: ${new Date(uploadedAt).toLocaleString()}` : ""}
                        </small>
                        ${!url ? `<div style="color:#e74c3c;margin-top:6px;font-size:12px;">❌ URL missing (upload not saved properly)</div>` : ""}
                      </div>

                      <div style="display:flex; gap:8px; flex-wrap:wrap;">
                        ${url ? `<a href="${url}" target="_blank" class="btn btn-primary" style="padding:8px 12px; text-decoration:none;">🔗 Open</a>` : ""}
                        ${url ? `<a href="${url}" download class="btn btn-success" style="padding:8px 12px; text-decoration:none;">⬇️ Download</a>` : ""}
                      </div>
                    </div>

                    ${isImage ? `
                      <div style="margin-top:10px;">
                        <img src="${url}" alt="${name}" style="width:100%; max-height:260px; object-fit:contain; border-radius:8px; background:white; border:1px solid #eee;">
                      </div>
                    ` : ""}
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  } catch (err) {
    console.error("❌ viewCustomerDocuments:", err);
    alert("❌ Error loading documents");
  }
}

/* =========================================================
   ✅ BOOKINGS + CUSTOMERS + PAYMENTS
   ========================================================= */
async function handleBookingSubmit(e) {
  e.preventDefault();

  if (!selectedRooms.length) {
    alert("Please select at least one room!");
    return false;
  }

  const checkInDate = $("checkInDate")?.value;
  const checkOutDate = $("checkOutDate")?.value;
  if (!checkOutDate) return alert("Please select check-out date"), false;

  const nights = parseInt($("numNights")?.value || 1);
  const roomPricePerNight = parseInt($("roomAmount")?.value || 0);
  const roomAmount = roomPricePerNight * nights;

  const additionalAmount = parseInt($("additionalAmount")?.value || 0);
  const advancePayment = parseInt($("advancePayment")?.value || 0);

  const customerName = $("cust1")?.value || "";
  const mobile = $("mobile1")?.value || "";
  const address = $("address")?.value || "";

  const totalAmount = roomAmount + additionalAmount;
  const balance = totalAmount - advancePayment;

  const customerId = "CUST" + String(customers.length + 1).padStart(4, "0");
  const bookingId = "BK" + String(bookingCounter).padStart(4, "0");

  // Button state
  const submitBtn =
    e.submitter || e.target.querySelector('button[type="submit"], input[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = "⏳ Creating booking...";
    submitBtn.disabled = true;
  }

  try {
    // 1) create customer
    await fetch(`${API_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        name: customerName,
        mobile,
        address,
        totalBookings: 1,
        documents: [],
        raw: {},
      }),
    });

    // 2) create booking
    const bookingPayload = {
      bookingId,
      customerName,
      mobile,
      roomNumbers: selectedRooms.map((r) => String(r.number)),
      checkInDate,
      checkInTime: $("checkInTime")?.value || "",
      checkOutDate,
      nights,
      roomPricePerNight,
      roomAmount,
      additionalAmount,
      totalAmount,
      paymentMode: $("paymentMode")?.value || "",
      advance: advancePayment,
      balance,
      status: "Confirmed",
      raw: {},
    };

    const res = await fetch(`${API_URL}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingPayload),
    });

    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Failed to create booking");

    // 3) payment (if advance > 0)
    if (advancePayment > 0) {
      await fetch(`${API_URL}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: "PAY" + String(payments.length + 1).padStart(4, "0"),
          bookingId,
          customerName,
          amount: advancePayment,
          paymentMode: $("paymentMode")?.value || "",
          date: new Date().toLocaleDateString("en-GB"),
          time: time12(),
          raw: { note: "Advance payment" },
        }),
      });
    }

    // 4) upload docs
    const uploadedDocs = await uploadDocuments(customerId, bookingId);

    bookingCounter++;

    alert(
      `✅ Booking created!\n\n` +
        `📋 Booking ID: ${bookingId}\n` +
        `👤 Customer: ${customerName}\n` +
        `🏠 Rooms: ${selectedRooms.map((r) => r.number).join(", ")}\n` +
        `🌙 Nights: ${nights}\n` +
        `💰 Total: ₹${totalAmount}\n` +
        `✅ Advance: ₹${advancePayment}\n` +
        `⚠️ Balance: ₹${balance}\n` +
        `📄 Documents: ${uploadedDocs.length}`
    );

    // reset form
    e.target.reset();
    selectedRooms = [];
    document.querySelectorAll(".room-box").forEach((b) => b.classList.remove("selected"));
    updateSelectedRoomsList();

    await loadAllData();

  } catch (err) {
    console.error("❌ handleBookingSubmit:", err);
    alert("❌ Failed: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.textContent = "✅ Create Booking & Generate Invoice";
      submitBtn.disabled = false;
    }
  }

  return false;
}

async function handleAdvanceBookingSubmit(e) {
  e.preventDefault();

  const customerName = $("advCustomerName")?.value || "";
  const mobile = $("advMobileNumber")?.value || "";
  const checkInDate = $("advCheckInDate")?.value || "";
  const checkOutDate = $("advCheckOutDate")?.value || "";
  const checkInTime = $("advCheckInTime")?.value || "";
  const totalAmount = parseInt($("advTotalAmount")?.value || 0);
  const advanceAmount = parseInt($("advAdvanceAmount")?.value || 0);
  const numPersons = $("advNumPersons")?.value || "";
  const note = $("advNote")?.value || "";

  const bookingId = "BK" + String(bookingCounter).padStart(4, "0");
  const customerId = "CUST" + String(customers.length + 1).padStart(4, "0");

  try {
    // booking
    const bookingData = {
      bookingId,
      customerName,
      mobile,
      roomNumbers: [],
      status: "Advance Booking",
      checkInDate,
      checkInTime,
      checkOutDate,
      nights: calculateNights(checkInDate, checkOutDate),
      roomPricePerNight: 0,
      roomAmount: 0,
      additionalAmount: 0,
      totalAmount,
      advance: advanceAmount,
      balance: totalAmount - advanceAmount,
      raw: { numPersons, note },
    };

    const res = await fetch(`${API_URL}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData),
    });
    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Failed to create advance booking");

    // customer
    await fetch(`${API_URL}/customers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        name: customerName,
        mobile,
        address: "",
        totalBookings: 1,
        documents: [],
        raw: {},
      }),
    });

    // payment
    if (advanceAmount > 0) {
      await fetch(`${API_URL}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: "PAY" + String(payments.length + 1).padStart(4, "0"),
          bookingId,
          customerName,
          amount: advanceAmount,
          paymentMode: "cash",
          date: new Date().toLocaleDateString("en-GB"),
          time: time12(),
          raw: { note: "Advance booking payment" },
        }),
      });
    }

    bookingCounter++;
    alert(`✅ Advance Booking created!\n\n📋 Booking ID: ${bookingId}\nRoom will be allocated on check-in.`);

    e.target.reset();
    await loadAllData();
  } catch (err) {
    console.error("❌ handleAdvanceBookingSubmit:", err);
    alert("❌ Failed: " + err.message);
  }

  return false;
}

/* =========================================================
   ✅ FOOD ORDERS (Walk-in + attach to booking)
   ========================================================= */
function searchFoodMenu() {
  const searchInput = document.getElementById("foodSearch");
  const term = (searchInput?.value || "").toLowerCase().trim();

  filteredFoodItems = !term
    ? [...foodItems]                      // ✅ show all when empty
    : foodItems.filter(item =>
        item.name.toLowerCase().includes(term)
      );

  initializeFoodMenu();
}


function initializeFoodMenu() {
  const foodMenu = $("foodMenu");
  if (!foodMenu) return;

  foodMenu.innerHTML = "";
  filteredFoodItems.forEach((item) => {
    const div = document.createElement("div");
    div.className = "food-item";
    div.innerHTML = `
      <h4>${item.name}</h4>
      <div class="price">₹${item.price}</div>
      <div style="
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: #f7f7f7;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid #ddd;
">

  <button
    onclick="updateFoodQty('${item.id}', -1)"
    style="
      height: 26px;
      width: 26px;
      border-radius: 50%;
      border: none;
      background-color: #e74c3c;
      color: white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    "
  >−</button>

  <span
    id="qty-${item.id}"
    style="
      min-width: 20px;
      text-align: center;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    "
  >
    ${foodOrder[item.id] || 0}
  </span>

  <button
    onclick="updateFoodQty('${item.id}', 1)"
    style="
      height: 26px;
      width: 26px;
      border-radius: 50%;
      border: none;
      background-color: #2ecc71;
      color: white;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    "
  >+</button>

</div>

    `;
    foodMenu.appendChild(div);
  });
}

function updateFoodQty(itemId, change) {
  if (!foodOrder[itemId]) foodOrder[itemId] = 0;
  foodOrder[itemId] = Math.max(0, foodOrder[itemId] + change);
  const qtyEl = $(`qty-${itemId}`);
  if (qtyEl) qtyEl.textContent = foodOrder[itemId];
  updateFoodTotal();
}

function updateFoodTotal() {
  let total = 0;
  for (let foodId in foodOrder) {
    const qty = Number(foodOrder[foodId] || 0);
    const item = foodItems.find((i) => String(i.id) === String(foodId));
    if (item) total += Number(item.price || 0) * qty;
  }
  const totalEl = $("foodTotal");
  if (totalEl) totalEl.textContent = total;
}

function editFoodItem(foodId) {
  const item = foodItems.find(i => i.id === foodId);
  if (!item) return;

  document.getElementById('foodModalTitle').textContent = 'Edit Food Item';
  document.getElementById('foodItemId').value = item.id; // FOOD0001
  document.getElementById('foodItemName').value = item.name;
  document.getElementById('foodItemPrice').value = item.price;

  document.getElementById('foodItemModal').classList.add('active');
}

async function createFoodOrder() {
  let orderItems = [];
  let totalAmount = 0;

  for (let foodId in foodOrder) {
    const qty = Number(foodOrder[foodId] || 0);
    if (qty <= 0) continue;

    const item = foodItems.find((i) => String(i.id) === String(foodId));
    if (!item) continue;

    const price = Number(item.price || 0);
    const total = price * qty;

    orderItems.push({ foodId: String(item.id), name: item.name, price, quantity: qty, total });
    totalAmount += total;
  }

  if (!orderItems.length) return alert("Please select at least one food item");

  try {
    const res = await fetch(`${API_URL}/food-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "Walk-in", items: orderItems }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to create food order");

    alert(`✅ Food order saved!\n\n📋 Order ID: ${data.order.orderId}\n💰 Total: ₹${data.order.totalAmount}`);

    foodOrder = {};
    filteredFoodItems = [...foodItems];
    const searchInput = $("foodSearch");
    if (searchInput) searchInput.value = "";
    initializeFoodMenu();
    updateFoodTotal();
  } catch (err) {
    console.error("❌ createFoodOrder:", err);
    alert("❌ Failed: " + err.message);
  }
}

function openFoodMenuForBooking(bookingId) {
  currentBookingForFood = bookingId;
  const booking = bookings.find((b) => b.bookingId === bookingId);
  if (!booking) return alert("Booking not found");

  foodOrder = {};
  filteredFoodItems = [...foodItems];
  initializeFoodMenu();
  updateFoodTotal();

  showSection("food");

  const addFoodBtn = document.querySelector("#food .btn-success");
  if (!addFoodBtn) return;

  addFoodBtn.textContent = `Add Food to Booking ${bookingId}`;
  addFoodBtn.onclick = async function () {
    let items = [];
    let total = 0;

    for (let id in foodOrder) {
      const qty = Number(foodOrder[id] || 0);
      if (!qty) continue;
      const item = foodItems.find((i) => i.id == id);
      if (!item) continue;
      items.push({ name: item.name, quantity: qty, price: item.price, total: item.price * qty });
      total += item.price * qty;
    }

    if (!items.length) return alert("Please select at least one food item");

    try {
      const res = await fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}/add-food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ foodItems: items, foodTotal: total }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.error || "Failed to add food");

      alert(`✅ Food added!\nTotal: ₹${total}`);
      foodOrder = {};
      currentBookingForFood = null;
      await loadAllData();
      showSection("bookings");
    } catch (err) {
      console.error("❌ add-food:", err);
      alert("❌ Failed: " + err.message);
    }
  };
}

/* =========================================================
   ✅ DASHBOARD + TABLES
   ========================================================= */
function updateDashboard() {
  const totalRooms = rooms.first.length + rooms.second.length + rooms.third.length;
  if ($("totalRooms")) $("totalRooms").textContent = totalRooms;

  const confirmedBookings = bookings.filter((b) => b.status === "Confirmed").length;
  if ($("bookingCount")) $("bookingCount").textContent = confirmedBookings;

  const availableCount = [...rooms.first, ...rooms.second, ...rooms.third].filter((r) => r.status === "available").length;
  if ($("availableCount")) $("availableCount").textContent = availableCount;

  const today = new Date().toLocaleDateString("en-GB");
  const revenueToday = payments.filter((p) => p.date === today).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  if ($("revenueToday")) $("revenueToday").textContent = "₹" + revenueToday;

  const pendingAmount = bookings.reduce((sum, b) => {
    const paid = payments
      .filter((p) => p.bookingId === b.bookingId)
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const bal = Number(b.totalAmount || 0) - paid;
    return sum + (bal > 0 ? bal : 0);
  }, 0);

  if ($("pendingAmount")) $("pendingAmount").textContent = "₹" + pendingAmount;

  const advanceCount = bookings.filter((b) => b.status === "Advance Booking").length;
  if ($("advanceBookings")) $("advanceBookings").textContent = advanceCount;

  let advanceBookings = bookings.filter(b => b.status === 'Advance Booking').length;
    document.getElementById('advanceBookings').textContent = advanceBookings;
    
    const recentTable = document.getElementById('recentBookingsTable');
    if (recentTable && bookings.length > 0) {
        const recentBookings = bookings.filter(b => b.status === 'Confirmed').slice(-5).reverse();
        if (recentBookings.length > 0) {
            recentTable.innerHTML = `<table><thead><tr><th>Booking ID</th><th>Customer</th><th>Room</th><th>Check-in</th><th>Nights</th><th>Total</th><th>status</th></tr></thead><tbody>
                ${recentBookings.map(b => {
                    const nights = Number(b.nights || calculateNights(b.checkInDate, b.checkOutDate));
                    return `<tr><td>${b['bookingId']}</td><td>${b['customerName']}</td><td>${b['roomNumbers']}</td><td>${b['checkInDate']}</td><td>${nights}</td><td>₹${b['totalAmount']}</td><td><span class="badge badge-success">${b.status}</span></td></tr>`;
                }).join('')}</tbody></table>`;
        } else {
            recentTable.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 30px;">No confirmed bookings yet</p>';
        }
    }
}

function updateAllTables() {
  /* -------- BOOKINGS TABLE -------- */
  const allBookingsTable = $("allBookingsTable");

  
  if (allBookingsTable) {
    const list = bookings.filter((b) =>
  ["Confirmed", "Cancelled", "Advance Booking", "Checked Out"].includes(b.status)
);

    allBookingsTable.innerHTML = !list.length
      ? `<tr><td colspan="10" style="text-align:center;color:#7f8c8d;">No bookings yet</td></tr>`
      : list
          .map((b) => {
            const paid = payments
              .filter((p) => p.bookingId === b.bookingId)
              .reduce((s, p) => s + (Number(p.amount) || 0), 0);

            const currentBalance = Number(b.totalAmount || 0) - paid;
            const hasBalance = currentBalance > 0;
            const isConfirmed = b.status === "Confirmed";

            const badgeClass =
              b.status === "Cancelled" ? "danger" :
              b.status === "Advance Booking" ? "warning" : "success";

            return `
              <tr>
                <td>${b.bookingId}</td>
                <td>${b.customerName}<br><small style="color:#7f8c8d;">${b.mobile}</small></td>
                <td>${(b.roomNumbers || []).join(", ") || "TBD"}</td>
                <td>${b.checkInDate}<br><small style="color:#27ae60;">${b.checkInTime || "N/A"}</small></td>
                <td>${b.checkOutDate || "Not set"}</td>
                <td>${b.nights} ${b.nights === 1 ? "night" : "nights"}</td>
                <td>₹${b.roomPricePerNight}/night<br><small style="color:#7f8c8d;">Total: ₹${b.roomAmount}</small></td>
                <td>₹${b.totalAmount}</td>
                <td>
                  <span class="badge badge-${badgeClass}">${b.status}</span>
                  ${hasBalance ? `<br><span class="badge badge-warning" style="margin-top:5px;">Balance: ₹${currentBalance}</span>` : ""}
                </td>
                <td>
                  <div class="action-buttons">
                    ${isConfirmed ? `
                      <button class="action-btn btn-primary" onclick="openFoodMenuForBooking('${b.bookingId}')">🍽️ Food</button>
                      <button class="action-btn btn-warning" onclick="openEditBookingModal('${b.bookingId}')">✏️ Edit</button>
                    ` : ""}

                    ${hasBalance ? `
                      <button class="action-btn btn-info" onclick="openPaymentModal('${b.bookingId}')"
                        style="background:#f39c12;border:2px solid #e67e22;font-weight:bold;">💰 Payment</button>
                    ` : ""}

                    ${isConfirmed ? `<button class="action-btn btn-danger" onclick="checkoutBooking('${b.bookingId}')">📤 Checkout</button>` : ""}

                    <button class="action-btn btn-success" onclick="printInvoiceMini('${b.bookingId}')">🖨️ Print</button>
                    <button class="action-btn btn-danger" onclick="deleteBooking('${b.bookingId}')">🗑️ Delete</button>
                  </div>
                </td>
              </tr>
            `;
          })
          .join("");
  }

  /* -------- CUSTOMERS TABLE -------- */
  const customersTable = $("customersTable");
  if (customersTable) {
    customersTable.innerHTML = !customers.length
      ? `<tr><td colspan="7" style="text-align:center;color:#7f8c8d;">No customers yet</td></tr>`
      : customers
          .map((c) => {
            const docCount = Array.isArray(c.documents) ? c.documents.length : 0;
            return `
              <tr>
                <td>${c.customerId}</td>
                <td>${c.name}</td>
                <td>${c.mobile}</td>
                <td>${c.address}</td>
                <td>${c.totalBookings}</td>
                <td>
                  ${
                    docCount > 0
                      ? `<button class="btn btn-info" onclick="viewCustomerDocuments('${c.customerId}')"
                            style="background:#3498db;padding:8px 12px;">📁 View (${docCount})</button>`
                      : `<span style="color:#95a5a6;">No documents</span>`
                  }
                </td>
                <td><button class="action-btn btn-danger" onclick="deleteCustomer('${c.customerId}')">🗑️ Delete</button></td>
              </tr>
            `;
          })
          .join("");
  }

  /* -------- PAYMENTS TABLE -------- */
  const paymentsTable = $("paymentsTable");
  if (paymentsTable) {
    paymentsTable.innerHTML = !payments.length
      ? `<tr><td colspan="8" style="text-align:center;color:#7f8c8d;">No payments yet</td></tr>`
      : payments
          .map(
            (p) => `
            <tr>
              <td>${p.paymentId}</td>
              <td>${p.bookingId}</td>
              <td>${p.customerName}</td>
              <td>₹${Number(p.amount || 0)}</td>
              <td>${p.paymentMode}</td>
              <td>${p.date}</td>
              <td><span class="badge badge-success">Completed</span></td>
              <td><button class="action-btn btn-danger" onclick="deletePayment('${p.paymentId}')">🗑️ Delete</button></td>
            </tr>
          `
          )
          .join("");
  }

  /* -------- ADVANCE BOOKINGS -------- */
  const advanceBookingsTable = $("advanceBookingsTable");
  if (advanceBookingsTable) {
    const adv = bookings.filter((b) => b.status === "Advance Booking");
    advanceBookingsTable.innerHTML = !adv.length
      ? `<tr><td colspan="10" style="text-align:center;color:#7f8c8d;">No advance bookings yet</td></tr>`
      : adv
          .map(
            (b) => `
            <tr>
              <td>${b.bookingId}</td>
              <td>${b.customerName}</td>
              <td>${b.mobile}</td>
              <td>${b.checkInDate}</td>
              <td>${b.checkOutDate}</td>
              <td>${b.nights}</td>
              <td>₹${Number(b.totalAmount || 0)}</td>
              <td>₹${Number(b.advance || 0)}</td>
              <td><span class="badge badge-warning">Advance</span></td>
              <td>
  <button class="action-btn btn-warning" onclick="openEditBookingModal('${b.bookingId}')">✏️ Edit</button>
  <button class="action-btn btn-danger" onclick="deleteBooking('${b.bookingId}')">🗑️ Delete</button>
</td>
              
            </tr>
          `
          )
          .join("");
  }
}

async function handleEditBookingSubmit(e) {
  console.log('edit functiom called')
  e.preventDefault();

  const bookingId = document.getElementById("editBookingId").value.trim();
  const b = bookings.find(x => x.bookingId === bookingId);
  if (!b) return alert("Booking not found");

  const nights = Number(document.getElementById("editNights").value || 1);
  const roomPricePerNight = Number(document.getElementById("editRoomAmountPerNight").value || 0);
  const additionalAmount = Number(document.getElementById("editAdditionalAmount").value || 0);

  const payload = {
    bookingId,
    customerName: document.getElementById("editCustomerName").value.trim(),
    mobile: document.getElementById("editMobileNumber").value.trim(),
    checkInDate: document.getElementById("editCheckInDate").value,
    checkOutDate: document.getElementById("editCheckOutDate").value,
    nights,
    roomPricePerNight,
    additionalAmount,

    // keep rooms + status same (so rooms won’t get freed)
    roomNumbers: Array.isArray(b.roomNumbers) ? b.roomNumbers : [],
    status: b.status,

    // store note inside raw safely
    raw: { ...(b.raw || {}), Note: document.getElementById("editNote").value.trim() }
  };

  console.log('edit payload is ',payload)

  try {
    const res = await fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Failed to update");

    alert("✅ Booking updated successfully!");
    closeEditBookingModal();
    await loadAllData();
  } catch (err) {
    console.error("❌ edit booking:", err);
    alert("❌ " + err.message);
  }

  return false;
}

function openEditBookingModal(bookingId) {
  const b = bookings.find(x => x.bookingId === bookingId);
  if (!b) return;

  document.getElementById("editBookingId").value = b.bookingId;
  document.getElementById("editCustomerName").value = b.customerName || "";
  document.getElementById("editMobileNumber").value = b.mobile || "";
  document.getElementById("editCheckInDate").value = b.checkInDate || "";
  document.getElementById("editCheckOutDate").value = b.checkOutDate || "";

  document.getElementById("editNights").value = b.nights || 1;
  document.getElementById("editRoomAmountPerNight").value = b.roomPricePerNight || 0;
  document.getElementById("editAdditionalAmount").value = b.additionalAmount || 0;

  document.getElementById("editNote").value = (b.raw?.Note || b.raw?.note || "") || "";

  document.getElementById("editBookingModal").classList.add("active");
}

function closeEditBookingModal() {
    document.getElementById('editBookingModal').classList.remove('active');
}

/* =========================================================
   ✅ PAYMENTS MODAL
   ========================================================= */
function openPaymentModal(bookingId) {
  const booking = bookings.find((b) => b.bookingId === bookingId);
  if (!booking) return;

  const paid = payments.filter((p) => p.bookingId === bookingId).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Number(booking.totalAmount || 0) - paid;

  $("paymentBookingId").value = bookingId;
  $("paymentCustomerName").textContent = booking.customerName;
  $("paymentRoomNumber").textContent = (booking.roomNumbers || []).join(", ");
  $("paymentBalance").textContent = balance;

  $("paymentModal").classList.add("active");
}

function closePaymentModal() {
  $("paymentModal").classList.remove("active");
  $("paymentForm")?.reset();
}

async function handlePaymentSubmit(e) {
  e.preventDefault();

  const bookingId = $("paymentBookingId").value;
  const amount = parseInt($("paymentAmount").value || 0);
  const paymentMode = $("paymentMethod").value;
  const note = $("paymentNote").value;

  const booking = bookings.find((b) => b.bookingId === bookingId);
  if (!booking) return alert("Booking not found"), false;

  const paid = payments.filter((p) => p.bookingId === bookingId).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Number(booking.totalAmount || 0) - paid;

  if (amount > balance) return alert("⚠️ Payment amount cannot exceed balance!"), false;

  try {
    const payload = {
      paymentId: "PAY" + String(payments.length + 1).padStart(4, "0"),
      bookingId,
      customerName: booking.customerName,
      amount,
      paymentMode,
      date: new Date().toLocaleDateString("en-GB"),
      time: time12(),
      raw: { note, type: "Partial Payment" },
    };

    const res = await fetch(`${API_URL}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok || !result.success) throw new Error(result.error || "Failed");

    alert(`✅ Payment recorded!\n\nPaid: ₹${amount}`);
    closePaymentModal();
    await loadAllData();
  } catch (err) {
    console.error("❌ handlePaymentSubmit:", err);
    alert("❌ " + err.message);
  }

  return false;
}

/* =========================================================
   ✅ CHECKOUT
   ========================================================= */
async function checkoutBooking(bookingId) {
  const booking = bookings.find(b => b.bookingId === bookingId);
  if (!booking) return alert("Booking not found");

  const paid = payments
    .filter(p => String(p.bookingId) === String(bookingId))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const balance = Number(booking.totalAmount || 0) - paid;

  // ✅ RULE #6 (pending must be 0 before checkout)
  if (balance > 0) {
    alert(`⚠️ Pending Balance: ₹${balance}\n\nPlease clear pending payment first, then checkout.`);
    return;
  }

  // ✅ Manual checkout time
  const manualTime = prompt("Enter Checkout Time (example: 02:35 PM)", time12());
  if (!manualTime) return;

  const manualDate = dateGB(); // today

  if (!confirm(`Checkout booking ${bookingId}?\n\n✅ Fully paid.\n🕐 Checkout Time: ${manualTime}`)) return;

  try {
    const res = await fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutTime: manualTime,
        checkoutDate: manualDate,
      }),
    });

    const result = await res.json();
    if (!res.ok || result.success === false) throw new Error(result.error || "Checkout failed");

    alert(`✅ Checkout completed!\n🕐 Time: ${result.checkoutTime}\n📅 Date: ${result.checkoutDate}`);
    await loadAllData();
  } catch (err) {
    console.error("❌ checkout:", err);
    alert("❌ " + err.message);
  }
}


/* =========================================================
   ✅ DELETE
   ========================================================= */
async function deleteBooking(bookingId) {
  if (!confirm("Delete this booking?")) return;
  try {
    const res = await fetch(`${API_URL}/bookings/${encodeURIComponent(bookingId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
    alert("✅ Booking deleted");
    await loadAllData();
  } catch (err) {
    alert("❌ " + err.message);
  }
}

async function deleteCustomer(customerId) {
  if (!confirm("Delete this customer?")) return;
  try {
    const res = await fetch(`${API_URL}/customers/${encodeURIComponent(customerId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
    alert("✅ Customer deleted");
    await loadAllData();
  } catch (err) {
    alert("❌ " + err.message);
  }
}

async function deletePayment(paymentId) {
  if (!confirm("Delete this payment?")) return;
  try {
    const res = await fetch(`${API_URL}/payments/${encodeURIComponent(paymentId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
    alert("✅ Payment deleted");
    await loadAllData();
  } catch (err) {
    alert("❌ " + err.message);
  }
}

/* =========================================================
   ✅ STAFF + ATTENDANCE
   ========================================================= */
function updateStaffTable() {
  const staffTable = $("staffTable");
  if (!staffTable) return;

  if (!Array.isArray(staff) || !staff.length) {
    staffTable.innerHTML =
      '<tr><td colspan="8" style="text-align:center; color:#7f8c8d;">No staff members yet.</td></tr>';
    return;
  }

  const todayGB = new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY

  staffTable.innerHTML = staff
    .map((s) => {
      const staffId = s.staffId || "-";
      const todayAttendance = attendance.find((a) => a.staffId === staffId && a.date === todayGB);

      const badge = todayAttendance
        ? `<span class="badge badge-${todayAttendance.status === "Present" ? "success" : "danger"}">${todayAttendance.status}</span>`
        : `<span class="badge" style="background:#95a5a6; color:white;">Not Marked</span>`;

      return `
        <tr>
          <td>${staffId}</td>
          <td>${s.name || "-"}</td>
          <td>${s.mobile || "-"}</td>
          <td>${s.position || "-"}</td>
          <td>₹${Number(s.salary || 0)}</td>
          <td>${s.joinDate || "-"}</td>
          <td>
            ${badge}
            <div style="margin-top: 5px;">
              <button class="action-btn btn-success" onclick="markAttendance('${staffId}', 'Present')" style="padding: 4px 8px; font-size: 10px;">P</button>
              <button class="action-btn btn-danger" onclick="markAttendance('${staffId}', 'Absent')" style="padding: 4px 8px; font-size: 10px;">A</button>
            </div>
          </td>
          <td>
            <button class="action-btn btn-warning" onclick="openEditStaffModal('${staffId}')">✏️ Edit</button>
            <button class="action-btn btn-danger" onclick="deleteStaff('${staffId}')">🗑️ Delete</button>
          </td>
        </tr>
      `;
    })
    .join("");
     const attendanceTable = document.getElementById("attendanceTable");
  if (attendanceTable) {
    if (!Array.isArray(attendance) || attendance.length === 0) {
      attendanceTable.innerHTML =
        '<tr><td colspan="6" style="text-align:center; color:#7f8c8d;">No attendance records yet</td></tr>';
    } else {
      attendanceTable.innerHTML = attendance
        .map((a) => `
          <tr>
            <td>${a.attendanceId || "-"}</td>
            <td>${a.staffId || "-"}</td>
            <td>${a.staffName || "-"}</td>
            <td>${a.date || "-"}</td>
            <td>${a.time || "-"}</td>
            <td><span class="badge badge-${a.status === "Present" ? "success" : "danger"}">${a.status}</span></td>
          </tr>
        `)
        .join("");
    }
  }
}

async function handleStaffSubmit(e) {
  e.preventDefault();

  const staffId = $("staffId").value.trim();
  const payload = {
    name: $("staffName").value.trim(),
    mobile: $("staffMobile").value.trim(),
    position: $("staffPosition").value.trim(),
    salary: Number($("staffSalary").value || 0),
    joinDate: $("staffJoinDate").value || "",
  };

  if (!payload.name) return alert("❌ Staff name is required"), false;

  try {
    const res = await fetch(
      staffId ? `${API_URL}/staff/${encodeURIComponent(staffId)}` : `${API_URL}/staff`,
      {
        method: staffId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed to save staff");

    alert(staffId ? "✅ Staff updated!" : "✅ Staff added!");
    closeStaffModal();
    await loadAllData();
  } catch (err) {
    alert("❌ " + err.message);
  }

  return false;
}

function openAddStaffModal() {
  $("staffModalTitle").textContent = "Add New Staff";
  $("staffForm").reset();
  $("staffId").value = "";
  $("staffModal").classList.add("active");
}

function openEditStaffModal(staffId) {
  const s = staff.find((x) => x.staffId === staffId);
  if (!s) return alert("Staff not found");

  $("staffModalTitle").textContent = "Edit Staff";
  $("staffId").value = s.staffId;
  $("staffName").value = s.name || "";
  $("staffMobile").value = s.mobile || "";
  $("staffPosition").value = s.position || "";
  $("staffSalary").value = s.salary || 0;
  $("staffJoinDate").value = s.joinDate || "";
  $("staffModal").classList.add("active");
}

function closeStaffModal() {
  $("staffModal").classList.remove("active");
}

async function deleteStaff(staffId) {
  if (!confirm("Delete this staff member?")) return;

  try {
    const res = await fetch(`${API_URL}/staff/${encodeURIComponent(staffId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");
    alert("✅ Staff deleted!");
    await loadAllData();
  } catch (err) {
    alert("❌ " + err.message);
  }
}

async function markAttendance(staffId, status) {
  const s = staff.find((x) => x.staffId === staffId);
  if (!s) return alert("❌ Staff not found");

  const payload = {
    staffId,
    staffName: s.name,
    date: new Date().toLocaleDateString("en-GB"),
    time: time12(),
    status,
  };

  try {
    const res = await fetch(`${API_URL}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed");

    alert(`✅ Attendance marked as ${status}${data.updated ? " (updated)" : ""}`);
    await loadAllData();
  } catch (err) {
    alert("❌ " + err.message);
  }
}

/* =========================================================
   ✅ ATTENDANCE CALENDAR (kept, but compact)
   ========================================================= */
function renderAttendanceCalendar() {
  const monthDisplay = $("attendanceMonthDisplay");
  if (!monthDisplay) return;

  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const year = currentAttendanceMonth.getFullYear();
  const month = currentAttendanceMonth.getMonth();
  monthDisplay.textContent = `${monthNames[month]} ${year}`;

  const calendarView = $("attendanceCalendarView");
  const reportView = $("attendanceReportView");

  if (currentAttendanceView === "calendar") {
    if (calendarView) calendarView.style.display = "block";
    if (reportView) reportView.style.display = "none";
    renderCalendarView(year, month);
  } else {
    if (calendarView) calendarView.style.display = "none";
    if (reportView) reportView.style.display = "block";
    renderReportView(year, month);
  }
}

function renderCalendarView(year, month) {
  const grid = $("attendanceGrid");
  if (!grid) return;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `
    <div style="display:grid; grid-template-columns:150px repeat(${daysInMonth}, 50px); gap:2px; background:#ecf0f1; padding:10px; border-radius:8px; overflow-x:auto;">
      <div style="background:#34495e; color:white; padding:10px; font-weight:bold; position:sticky; left:0; z-index:10;">Staff Name</div>
      ${Array.from({ length: daysInMonth }, (_, i) => `<div style="background:#34495e;color:white;padding:10px;text-align:center;font-weight:bold;min-width:50px;">${i+1}</div>`).join("")}
  `;

  if (!staff.length) {
    html += `<div style="grid-column:1/-1;padding:30px;text-align:center;color:#7f8c8d;background:white;border-radius:5px;">No staff members</div>`;
  } else {
    staff.forEach((s) => {
      html += `<div style="background:white;padding:10px;font-weight:600;position:sticky;left:0;z-index:5;border-right:2px solid #bdc3c7;">${s.name || "-"}</div>`;

      for (let day = 1; day <= daysInMonth; day++) {
        const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const gb = toGBDateFromISO(iso);

        const rec = attendance.find((a) => a.staffId === s.staffId && a.date === gb);

        let bg = "#ecf0f1", text = "-", border = "#bdc3c7";
        if (rec?.status === "Present") { bg = "#2ecc71"; text = "P"; border = "#27ae60"; }
        if (rec?.status === "Absent")  { bg = "#e74c3c"; text = "A"; border = "#c0392b"; }

        html += `
          <div style="background:${bg};color:${text === "-" ? "#7f8c8d" : "white"};padding:10px;text-align:center;font-weight:bold;border:2px solid ${border};min-width:50px;cursor:pointer;"
            onclick="markAttendanceFromCalendar('${s.staffId}','${iso}')">${text}</div>
        `;
      }
    });
  }

  html += `</div>`;
  grid.innerHTML = html;
}

function renderReportView(year, month) {
  const reportTable = $("attendanceReportTable");
  if (!reportTable) return;

  if (!staff.length) {
    reportTable.innerHTML =
      '<tr><td colspan="6" style="text-align:center; color:#7f8c8d;">No staff members</td></tr>';
    return;
  }

  reportTable.innerHTML = staff
    .map((s) => {
      const staffAttendance = attendance.filter((a) => {
        if (a.staffId !== s.staffId) return false;
        const iso = toISODateKeyFromGB(a.date);
        if (!iso) return false;
        const d = new Date(iso);
        return d.getMonth() === month && d.getFullYear() === year;
      });

      const present = staffAttendance.filter((a) => a.status === "Present").length;
      const absent = staffAttendance.filter((a) => a.status === "Absent").length;
      const total = present + absent;
      const percent = total ? ((present / total) * 100).toFixed(1) : "0.0";

      const color = Number(percent) >= 80 ? "#27ae60" : Number(percent) >= 60 ? "#f39c12" : "#e74c3c";

      return `
        <tr>
          <td>${s.name || "-"}</td>
          <td>${s.position || "-"}</td>
          <td style="color:#27ae60;font-weight:bold;">${present}</td>
          <td style="color:#e74c3c;font-weight:bold;">${absent}</td>
          <td>${total}</td>
          <td style="color:${color};font-weight:bold;font-size:16px;">${percent}%</td>
        </tr>
      `;
    })
    .join("");
}

function markAttendanceFromCalendar(staffId, isoDate) {
  const s = staff.find((x) => x.staffId === staffId);
  if (!s) return;

  const dateObj = new Date(isoDate);
  const today = new Date(); today.setHours(0,0,0,0);
  dateObj.setHours(0,0,0,0);
  if (dateObj > today) return alert("⚠️ Cannot mark attendance for future dates");

  const gb = toGBDateFromISO(isoDate);
  const existing = attendance.find((a) => a.staffId === staffId && a.date === gb);

  const status = existing
    ? (confirm(`Current: ${existing.status}\nOK=Present | Cancel=Absent`) ? "Present" : "Absent")
    : (confirm(`Mark attendance for ${s.name}?\nOK=Present | Cancel=Absent`) ? "Present" : "Absent");

  saveAttendanceToServer({
    staffId,
    staffName: s.name,
    date: gb,
    time: time12(),
    status,
  });
}

async function saveAttendanceToServer(record) {
  try {
    const res = await fetch(`${API_URL}/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Failed");
    await loadAllData();
    renderAttendanceCalendar();
  } catch (err) {
    alert("❌ " + err.message);
  }
}

function previousAttendanceMonth() {
  currentAttendanceMonth.setMonth(currentAttendanceMonth.getMonth() - 1);
  renderAttendanceCalendar();
}

function nextAttendanceMonth() {
  currentAttendanceMonth.setMonth(currentAttendanceMonth.getMonth() + 1);
  renderAttendanceCalendar();
}

function switchAttendanceView(view) {
  currentAttendanceView = view;
  renderAttendanceCalendar();
}

/* =========================================================
   ✅ NAV / SECTIONS
   ========================================================= */
function toggleMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) sidebar.classList.toggle("mobile-open");
}

function showSection(sectionId, event) {
  document.querySelectorAll(".content-section").forEach((s) => s.classList.remove("active"));
  const el = $(sectionId);
  if (el) el.classList.add("active");

  document.querySelectorAll(".menu-item").forEach((i) => i.classList.remove("active"));
  if (event?.currentTarget) event.currentTarget.classList.add("active");

  const sidebar = document.querySelector(".sidebar");
  if (sidebar?.classList.contains("mobile-open")) sidebar.classList.remove("mobile-open");

  if (sectionId === "attendanceCalendar") renderAttendanceCalendar();
  if (sectionId === "roomStatus") showRoomStatus();

  if (sectionId === "food" && !currentBookingForFood) {
    const addFoodBtn = document.querySelector("#food .btn-success");
    if (addFoodBtn) {
      addFoodBtn.textContent = "Create Food Order (Walk-in)";
      addFoodBtn.onclick = createFoodOrder;
    }
  }
}

/* =========================================================
   ✅ MINI PRINT (kept small)
   ========================================================= */
function printInvoiceMini(bookingId) {
  const booking = bookings.find(b => String(b.bookingId) === String(bookingId));
  if (!booking) return alert("Booking not found");

  const bookingPayments = payments.filter(p => String(p.bookingId) === String(bookingId));

  const totalAmount = Number(booking.totalAmount || 0);
  const totalPaid = bookingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const rawBalance = totalAmount - totalPaid;
  const balanceDue = Math.max(0, rawBalance);
  const extraPaid = Math.max(0, -rawBalance);

  // Food orders: prefer booking.foodOrders, else fallback raw
  const foodList =
    Array.isArray(booking.foodOrders) && booking.foodOrders.length
      ? booking.foodOrders
      : (Array.isArray(booking.raw?.["Food Orders"]) ? booking.raw["Food Orders"] : []);

  let foodHTML = "";
  if (foodList.length) {
    foodHTML = foodList.map(i =>
      `<tr><td>🍽️ ${i.name} (x${i.quantity})</td><td style="text-align:right;font-weight:bold;">₹${Number(i.total || 0)}</td></tr>`
    ).join("");
  }

  // Payment History HTML
  let paymentHistoryHTML = "";
  if (bookingPayments.length > 0) {
    paymentHistoryHTML = `
      <div style="margin: 20px 0; padding: 15px; background: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px;">
        <h3 style="color: #2e7d32; margin: 0 0 12px 0; font-size: 16px;">💰 Payment History</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; background: white;">
          <thead>
            <tr style="background: #4caf50; color: white;">
              <th style="padding: 8px; text-align: left;">Date</th>
              <th style="padding: 8px; text-align: left;">Payment ID</th>
              <th style="padding: 8px; text-align: left;">Mode</th>
              <th style="padding: 8px; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${bookingPayments.map((p, idx) => `
              <tr style="background: ${idx % 2 === 0 ? '#f1f8e9' : 'white'};">
                <td style="padding: 8px;">${p.date || "-"}</td>
                <td style="padding: 8px;">${p.paymentId || "-"}</td>
                <td style="padding: 8px; text-transform: uppercase;">${p.paymentMode || "-"}</td>
                <td style="padding: 8px; text-align: right; font-weight: bold;">₹${Number(p.amount || 0)}</td>
              </tr>
            `).join("")}
            <tr style="background: #c8e6c9; font-weight: bold;">
              <td colspan="3" style="padding: 10px; text-align: right;">Total Paid:</td>
              <td style="padding: 10px; text-align: right; font-size: 16px;">₹${totalPaid}</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const nights = Number(booking.nights || calculateNights(booking.checkInDate, booking.checkOutDate));
  const roomAmountPerNight = Number(booking.roomPricePerNight || 0);
  const totalRoomAmount = Number(booking.roomAmount || (roomAmountPerNight * nights));
  const additionalAmount = Number(booking.additionalAmount || 0);

  const roomType = booking.raw?.["Room Type"] || booking.type || "N/A";
  const address = booking.raw?.["Address"] || booking.raw?.address || "N/A";
  const numPersons = booking.raw?.["No. of Persons"] || booking.raw?.numPersons || "N/A";
  const note = booking.raw?.["Note"] || booking.raw?.note || "";

  const w = window.open("", "_blank", "width=900,height=700");
  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${booking.bookingId}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 15px; max-width: 800px; margin: 0 auto; font-size: 13px; }
    .header { text-align: center; margin-bottom: 15px; border-bottom: 3px solid #2c3e50; padding-bottom: 12px; }
    h1 { margin: 8px 0 3px; color: #2c3e50; font-size: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #2c3e50; color: white; }
    .summary-box { margin: 12px 0; padding: 12px; background: #fff3e0; border-radius: 6px; border: 2px solid #ff9800; }
  </style>
</head>
<body>
  <div class="header">
    <h1>SAI GANGA HOTEL</h1>
    <div style="font-size: 11px; margin: 8px 0;">${HOTEL_ADDRESS}</div>
    <p style="color: #27ae60; font-weight: bold;">🌿 100% PURE VEG</p>
    <div style="font-size: 18px; margin: 12px 0; font-weight: bold;">BOOKING INVOICE</div>
    <p><strong>Invoice:</strong> ${booking.bookingId}</p>
    <p style="font-size: 11px;">Date: ${new Date().toLocaleDateString("en-GB")} | Time: ${time12()}</p>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0;">
    <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">
      <h3 style="font-size: 13px; margin-bottom: 6px;">👤 Customer</h3>
      <p><strong>Name:</strong> ${booking.customerName || "-"}</p>
      <p><strong>Mobile:</strong> ${booking.mobile || "-"}</p>
      <p><strong>Address:</strong> ${address}</p>
      <p><strong>Persons:</strong> ${numPersons}</p>
    </div>

    <div style="padding: 10px; background: #f8f9fa; border-radius: 6px;">
      <h3 style="font-size: 13px; margin-bottom: 6px;">🏨 Booking</h3>
      <p><strong>Room:</strong> ${(booking.roomNumbers || []).join(", ") || "TBD"} (${roomType})</p>
      <p><strong>Check-in:</strong> ${booking.checkInDate || "-"} ${booking.checkInTime || ""}</p>
      <p><strong>Check-out:</strong> ${booking.checkOutDate || "Not set"} ${booking.raw?.["Check Out Time"] ? `<span style="color:#e74c3c;font-weight:bold;">${booking.raw["Check Out Time"]}</span>` : ""}</p>
      <p><strong>Nights:</strong> ${nights}</p>
    </div>
  </div>

  ${paymentHistoryHTML}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>🛏️ Room Charges (${nights} ${nights === 1 ? "night" : "nights"} @ ₹${roomAmountPerNight}/night)</td>
        <td style="text-align:right;font-weight:bold;">₹${totalRoomAmount}</td>
      </tr>

      ${additionalAmount > 0 ? `
        <tr>
          <td>➕ Additional Charges</td>
          <td style="text-align:right;font-weight:bold;">₹${additionalAmount}</td>
        </tr>
      ` : ""}

      ${foodHTML}
    </tbody>
  </table>

  <div class="summary-box">
    <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:bold;margin-bottom:6px;">
      <span>💵 Total Amount:</span><span>₹${totalAmount}</span>
    </div>

    <div style="display:flex;justify-content:space-between;color:#2e7d32;margin:6px 0;">
      <span>✅ Paid:</span><span>₹${totalPaid}</span>
    </div>

    <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:bold;color:${balanceDue === 0 ? "#2e7d32" : "#c62828"};padding-top:8px;border-top:2px solid #ff9800;">
      <span>${balanceDue === 0 ? "✅" : "⚠️"} Balance Due:</span><span>₹${balanceDue}</span>
    </div>

    ${extraPaid > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;color:#2e7d32;margin-top:8px;">
        <span>🟢 Extra Paid:</span><span>₹${extraPaid}</span>
      </div>
    ` : ""}
  </div>

  ${note ? `
    <div style="margin: 12px 0; padding: 10px; background: #fff9c4; border-left: 4px solid #fbc02d;">
      <p style="font-size: 11px;"><strong>📝 Note:</strong></p>
      <p style="font-size: 12px; margin-top: 4px;">${note}</p>
    </div>
  ` : ""}

  <div style="text-align:center;margin-top:15px;padding-top:12px;border-top:2px solid #ddd;font-size:11px;">
    <p style="font-weight:bold;font-size:14px;">Thank you! 🙏</p>
    <p style="margin: 8px 0; font-weight: bold;">📞 8390400008</p>
  </div>
</body>
</html>`);

  w.document.close();
  setTimeout(() => w.print(), 500);
}


function downloadExcel(type) {
  // This will open the file download in a new tab
  window.open(`${API_URL}/export/${encodeURIComponent(type)}`, "_blank");
}
function searchBookings() {
  const searchValue = document
    .getElementById("searchInput")
    .value
    .toLowerCase()
    .trim();

  const table = document.getElementById("allBookingsTable");
  if (!table) return;

  // If search box is empty → show all bookings
  if (!searchValue) {
    updateAllTables();
    return;
  }

  const filtered = bookings.filter(b => {
    return (
      (b.bookingId || "").toLowerCase().includes(searchValue) ||
      (b.customerName || "").toLowerCase().includes(searchValue) ||
      (b.mobile || "").toLowerCase().includes(searchValue) ||
      (Array.isArray(b.roomNumbers) ? b.roomNumbers.join(", ") : "")
        .toLowerCase()
        .includes(searchValue) ||
      (b.status || "").toLowerCase().includes(searchValue)
    );
  });

  if (filtered.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;color:#e74c3c;">
          ❌ No matching bookings found
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = filtered.map(b => {
    const rooms = Array.isArray(b.roomNumbers) ? b.roomNumbers.join(", ") : "TBD";

    return `
      <tr>
        <td>${b.bookingId}</td>
        <td>
          ${b.customerName || ""}
          <br><small>${b.mobile || ""}</small>
        </td>
        <td>${rooms}</td>
        <td>${b.checkInDate || ""}</td>
        <td>${b.checkOutDate || ""}</td>
        <td>${b.nights || 1}</td>
        <td>₹${b.roomAmount || 0}</td>
        <td>₹${b.totalAmount || 0}</td>
        <td>
          <span class="badge badge-success">${b.status || "-"}</span>
        </td>
        <td>
          <button class="action-btn btn-success" onclick="printInvoice('${b.bookingId}')">🖨️</button>
          <button class="action-btn btn-danger" onclick="deleteBooking('${b.bookingId}')">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
}

function searchPayments() {
  const q = document.getElementById("paymentSearch").value.toLowerCase().trim();
  const table = document.getElementById("paymentsTable");
  if (!table) return;

  if (!q) {
    updateAllTables();
    return;
  }

  const filtered = payments.filter(p =>
    (p.paymentId || "").toLowerCase().includes(q) ||
    (p.bookingId || "").toLowerCase().includes(q) ||
    (p.customerName || "").toLowerCase().includes(q) ||
    (p.paymentMode || "").toLowerCase().includes(q) ||
    (p.date || "").toLowerCase().includes(q)
  );

  table.innerHTML = filtered.length
    ? filtered.map(p => `
        <tr>
          <td>${p.paymentId}</td>
          <td>${p.bookingId}</td>
          <td>${p.customerName}</td>
          <td>₹${p.amount}</td>
          <td>${p.paymentMode}</td>
          <td>${p.date}</td>
          <td><span class="badge badge-success">Completed</span></td>
          <td>
            <button class="action-btn btn-danger" onclick="deletePayment('${p.paymentId}')">🗑️</button>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="8" style="text-align:center;color:#e74c3c;">No payments found</td></tr>`;
}

function searchCustomers() {
  const q = document.getElementById("customerSearch").value.toLowerCase().trim();
  const table = document.getElementById("customersTable");
  if (!table) return;

  if (!q) {
    updateAllTables();
    return;
  }

  const filtered = customers.filter(c =>
    (c.customerId || "").toLowerCase().includes(q) ||
    (c.name || "").toLowerCase().includes(q) ||
    (c.mobile || "").toLowerCase().includes(q) ||
    (c.address || "").toLowerCase().includes(q)
  );

  table.innerHTML = filtered.length
    ? filtered.map(c => `
        <tr>
          <td>${c.customerId}</td>
          <td>${c.name}</td>
          <td>${c.mobile}</td>
          <td>${c.address}</td>
          <td>${c.totalBookings || 0}</td>
          <td>
            ${c.documents?.length
              ? `<button class="btn btn-info" onclick="viewCustomerDocuments('${c.customerId}')">
                   📁 View (${c.documents.length})
                 </button>`
              : `<span style="color:#95a5a6;">No documents</span>`
            }
          </td>
          <td>
            <button class="action-btn btn-danger" onclick="deleteCustomer('${c.customerId}')">🗑️</button>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="7" style="text-align:center;color:#e74c3c;">No customers found</td></tr>`;
}


async function deleteFoodItem(foodId) {
  if (!confirm("Are you sure you want to delete this item?")) return;

  try {
    const res = await fetch(`${API_URL}/food/${encodeURIComponent(foodId)}`, {
      method: "DELETE"
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || "Delete failed");

    alert("✅ Food item deleted successfully!");

    await loadFoodItemsFromServer();
    filteredFoodItems = [...foodItems];
    renderFoodMenuManager();
    initializeFoodMenu();

  } catch (err) {
    console.error("❌ deleteFoodItem:", err);
    alert("❌ Failed: " + err.message);
  }
}


function renderFoodMenuManager() {
    const container = document.getElementById('foodMenuManager');
    if (!container) return;
    
    let html = `
        <div style="margin-bottom: 20px;">
            <button class="btn btn-success" onclick="openAddFoodItemModal()">+ Add New Item</button>
        </div>
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Item Name</th>
                        <th>Price</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>`;
    
    foodItems.forEach(item => {
        html += `
            <tr>
                <td>${item.id}</td>
                <td>${item.name}</td>
                <td>₹${item.price}</td>
                <td>
                    <button class="action-btn btn-warning" onclick="editFoodItem('${item.id}')">✏️ Edit</button>
                    <button class="action-btn btn-danger" onclick="deleteFoodItem('${item.id}')">🗑️ Delete</button>
                </td>
            </tr>`;
    });
    
    html += `</tbody></table></div>`;
    
    html += `
        <div id="foodItemModal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 id="foodModalTitle">Add Food Item</h2>
                    <span class="close-btn" onclick="closeFoodItemModal()">×</span>
                </div>
                <form id="foodItemForm" onsubmit="return handleFoodItemSubmit(event)">
                    <input type="hidden" id="foodItemId">
                    
                    <div class="form-group">
                        <label>Item Name *</label>
                        <input type="text" id="foodItemName" required>
                    </div>
                    
                    <div class="form-group">
                        <label>Price *</label>
                        <input type="number" id="foodItemPrice" required min="1">
                    </div>
                    
                    <div style="margin-top: 20px;">
                        <button type="submit" class="btn btn-success">✅ Save Item</button>
                        <button type="button" class="btn btn-danger" onclick="closeFoodItemModal()">Cancel</button>
                    </div>
                </form>
            </div>
        </div>`;
    
    container.innerHTML = html;
}

async function handleFoodItemSubmit(e) {
  e.preventDefault();

  const foodId = document.getElementById("foodItemId")?.value?.trim(); // will hold FOOD0001 when editing
  const itemName = document.getElementById("foodItemName")?.value?.trim();
  const itemPrice = Number(document.getElementById("foodItemPrice")?.value || 0);

  if (!itemName) {
    alert("❌ Please enter item name");
    return false;
  }
  if (Number.isNaN(itemPrice) || itemPrice <= 0) {
    alert("❌ Please enter valid price");
    return false;
  }

  try {
    // ✅ EDIT
    if (foodId) {
      const res = await fetch(`${API_URL}/food/${encodeURIComponent(foodId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: itemName, price: itemPrice })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Update failed");

      alert("✅ Food item updated successfully!");
    }
    // ✅ ADD
    else {
      const res = await fetch(`${API_URL}/food`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: itemName, price: itemPrice })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Create failed");

      alert("✅ Food item added successfully!");
    }

    // ✅ refresh UI from server
    await loadFoodItemsFromServer();
    filteredFoodItems = [...foodItems];
    renderFoodMenuManager();
    initializeFoodMenu();
    closeFoodItemModal();

  } catch (err) {
    console.error("❌ handleFoodItemSubmit:", err);
    alert("❌ Failed: " + err.message);
  }

  return false;
}

function logout() {
  localStorage.removeItem("sessionId");
  window.location.href = "login.html";
}

/* =========================================================
   ✅ INIT
   ========================================================= */
window.addEventListener("DOMContentLoaded", async () => {
  loadTheme();
  await loadFoodItemsFromServer();
  await loadAllData();
  renderAttendanceCalendar();
  renderFoodMenuManager()

  const bookingForm = $("bookingForm");
  if (bookingForm) bookingForm.addEventListener("submit", handleBookingSubmit);

  const advanceBookingForm = $("advanceBookingForm");
  if (advanceBookingForm) advanceBookingForm.addEventListener("submit", handleAdvanceBookingSubmit);

  const personsInput = $("numPersons");
  if (personsInput) {
    renderDocsRows(personsInput.value);
    personsInput.addEventListener("input", () => renderDocsRows(personsInput.value));
  }

  const checkInDate = $("checkInDate");
  const checkOutDate = $("checkOutDate");
  if (checkInDate && checkOutDate) {
    const update = () => {
      if (checkInDate.value && checkOutDate.value) {
        const nights = calculateNights(checkInDate.value, checkOutDate.value);
        const field = $("numNights");
        if (field) field.value = nights;
      }
    };
    checkInDate.addEventListener("change", update);
    checkOutDate.addEventListener("change", update);
  }

  
});
