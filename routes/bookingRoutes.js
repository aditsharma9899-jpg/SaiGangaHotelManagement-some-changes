const express = require("express");
const router = express.Router();

const Booking = require("../models/Booking");
const Room = require("../models/Rooms")
const Payment = require("../models/Payments");

/* ------------------ Helpers ------------------ */
function parseRoomNumbers(input) {
  if (!input) return [];

  // input can be ["101","102"] OR "101, 102"
  if (Array.isArray(input)) {
    return input.map(x => String(x).trim()).filter(Boolean);
  }

  return String(input)
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}


/*function parseRoomNumbers(roomNumberStr) {
  if (!roomNumberStr || typeof roomNumberStr !== "string") return [];
  if (roomNumberStr.includes("TBD")) return [];
  return roomNumberStr.split(",").map(s => s.trim()).filter(Boolean);
}*/

function computeAmounts(raw) {
  const nights = parseInt(raw.Nights || raw.nights) || 1;
  const roomPricePerNight =
    parseInt(raw["Room Price Per Night"] || raw.roomPricePerNight) || 0;

  const roomAmount = roomPricePerNight * nights;
  const additionalAmount =
    parseInt(raw["Additional Amount"] || raw.additionalAmount) || 0;

  const totalAmount = roomAmount + additionalAmount;
  const advance = parseInt(raw.Advance || raw.advance) || 0;
  const balance = totalAmount - advance;

  // write back in excel style keys (frontend compatibility)
  raw.Nights = nights;
  raw["Room Price Per Night"] = roomPricePerNight;
  raw["Room Amount"] = roomAmount;
  raw["Additional Amount"] = additionalAmount;
  raw["Total Amount"] = totalAmount;
  raw.Advance = advance;
  raw.Balance = balance;

  return { nights, roomPricePerNight, roomAmount, additionalAmount, totalAmount, advance, balance };
}

/* ------------------ GET ALL (optional but useful) ------------------ */
router.get("/", async (req, res) => {
  try {
    const docs = await Booking.find().sort({ createdAt: -1 }).lean();
    res.json({
      success: true,
      items: docs,                  // ✅ new UI
      rawItems: docs.map(d => d.raw) // ✅ old excel style if needed
    });
  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
});

/*router.get("/", async (req, res) => {
  try {
    const docs = await Booking.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, items: docs });
  } catch (error) {
    console.error("❌ Error fetching bookings:", error);
    res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
});*/ 

router.get("/:bookingId/cart", async (req, res) => {
  try {
    const bookingId = req.params.bookingId;

    const booking = await Booking.findOne({ bookingId }).lean();
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    return res.json({ success: true, cart: booking.draftCart || [] });
  } catch (err) {
    console.error("❌ get cart:", err);
    res.status(500).json({ success: false, error: "Failed to get cart" });
  }
});

router.put("/:bookingId/cart", async (req, res) => {
  try {
    const bookingId = req.params.bookingId;
    const cart = Array.isArray(req.body.cart) ? req.body.cart : [];

    const cleanCart = cart
      .filter(i => Number(i.quantity || 0) > 0)
      .map(i => ({
        foodId: String(i.foodId || ""),
        name: String(i.name || ""),
        price: Number(i.price || 0),
        quantity: Number(i.quantity || 0),
        total: Number(i.price || 0) * Number(i.quantity || 0),
      }))
      .filter(i => i.name);

    const booking = await Booking.findOneAndUpdate(
      { bookingId },
      { $set: { draftCart: cleanCart, draftCartUpdatedAt: new Date() } },
      { new: true }
    );

    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    return res.json({ success: true, cart: booking.draftCart });
  } catch (err) {
    console.error("❌ save cart:", err);
    res.status(500).json({ success: false, error: "Failed to save cart" });
  }
});


router.post("/:bookingId/add-food", async (req, res) => {
  try {
    const bookingId = req.params.bookingId;

    const foodItems = Array.isArray(req.body.foodItems) ? req.body.foodItems : [];
    const foodTotal = Number(req.body.foodTotal || 0);

    // ✅ allow empty cart + 0 total (for clearing)
    if (foodTotal < 0) {
      return res.status(400).json({ success: false, error: "foodTotal cannot be negative" });
    }

    // ✅ keep only items with qty > 0 (ignore qty 0 items)
    const cleanItems = foodItems
      .filter(i => Number(i.quantity || 0) > 0)
      .map(i => ({
        name: i.name,
        price: Number(i.price || 0),
        quantity: Number(i.quantity || 0),
        total: Number(i.total || 0),
      }));

    // ✅ recompute total from cleanItems (so no mismatch)
    const cleanTotal = cleanItems.reduce((s, i) => s + (Number(i.price) * Number(i.quantity)), 0);

    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    // ✅ REPLACE mode
    booking.foodOrders = cleanItems;
    booking.additionalAmount = cleanTotal;

    const roomAmount = Number(booking.roomAmount || 0);
    booking.totalAmount = roomAmount + Number(booking.additionalAmount || 0);

    const payDocs = await Payment.find({ bookingId });
    const totalPaid = payDocs.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    booking.advance = totalPaid;
    booking.balance = booking.totalAmount - totalPaid;

    await booking.save();

    res.json({
      success: true,
      booking: {
        bookingId: booking.bookingId,
        additionalAmount: booking.additionalAmount,
        totalAmount: booking.totalAmount,
        advance: booking.advance,
        balance: booking.balance,
        foodOrders: booking.foodOrders,
      },
    });
  } catch (err) {
    console.error("❌ add-food:", err);
    res.status(500).json({ success: false, error: "Failed to add food" });
  }
});

/* ------------------ POST CREATE (from previous message) ------------------ */
router.post("/", async (req, res) => {
  console.log("✅ NEW ROUTE VERSION RUNNING 123");
console.log("BODY.RAW:", req.body.raw);
  try {

    console.log('booking data',req.body)
    const body = req.body || {};
const extraRaw = body.raw && typeof body.raw === "object" ? body.raw : {};
const raw = { ...body, ...extraRaw };

    // ✅ Normalize values (support both Mongo style + Excel style)
    const bookingId = raw.bookingId || raw["Booking ID"] || "";
    const customerName = raw.customerName || raw["Customer Name"] || "";
    const mobile = raw.mobile || raw["Mobile"] || "";

    // ✅ Dates (your frontend sends checkInDate/checkOutDate)
    const checkInDate = raw.checkInDate || raw["Check In"] || "";
    const checkInTime = raw.checkInTime || raw["Check In Time"] || "";
    const checkOutDate = raw.checkOutDate || raw["Check Out"] || "";

    const status = raw.status || raw.Status || raw["Status"] || "";

    const nights = Number(raw.nights ?? raw.Nights ?? 1) || 1;

    // ✅ Rooms
    const roomNumbers = Array.isArray(raw.rooms)
      ? raw.rooms.map(r => String(r.number)).filter(Boolean)
      : Array.isArray(raw.roomNumbers)
        ? raw.roomNumbers.map(String)
        : [];

    // ✅ Amounts (support all keys)
    const roomPricePerNight = Number(raw.roomPricePerNight ?? raw["Room Price Per Night"] ?? 0) || 0;
    const additionalAmount  = Number(raw.additionalAmount ?? raw["Additional Amount"] ?? 0) || 0;

    // roomAmount can be sent OR calculated
    const roomAmount = Number(
      raw.roomAmount ?? raw["Room Amount"] ?? (roomPricePerNight * nights)
    ) || 0;

    // totalAmount can be sent OR calculated
    const totalAmount = Number(
      raw.totalAmount ?? raw["Total Amount"] ?? (roomAmount + additionalAmount)
    ) || 0;

    // ✅ advance can come as advance OR advanceAmount
    const advance = Number(
      raw.advance ?? raw["Advance"] ?? raw.advanceAmount ?? 0
    ) || 0;

    // ✅ balance always should be total - paid
    const balance = Number(raw.balance ?? raw["Balance"] ?? (totalAmount - advance));

    // ✅ Also keep an excel-like raw object so old UI never breaks
    const excelRaw = {
  ...body,        // keep all existing fields
  ...extraRaw,    // add address & numPersons safely
  "Booking ID": bookingId,
  "Customer Name": customerName,
  "Mobile": mobile,
  "Room Number": roomNumbers.length ? roomNumbers.join(", ") : "TBD",
  "Check In": checkInDate,
  "Check In Time": checkInTime,
  "Check Out": checkOutDate,
  "Nights": nights,
  "Room Price Per Night": roomPricePerNight,
  "Room Amount": roomAmount,
  "Additional Amount": additionalAmount,
  "Total Amount": totalAmount,
  "Advance": advance,
  "Balance": balance,
  "Status": status,
};
delete excelRaw.raw;


    // ✅ Save booking
    const created = await Booking.create({
      bookingId,
      customerName,
      mobile,
      roomNumbers,            // normalized
      status,
      checkInDate,            // ✅ schema field
      checkInTime,
      checkOutDate,           // ✅ schema field
      nights,
      roomPricePerNight,
      additionalAmount,
      roomAmount,
      totalAmount,
      advance,
      balance,
      raw: excelRaw
    });

    // ✅ Occupy rooms only when rooms exist
    if (roomNumbers.length > 0) {
      await Room.updateMany(
        { roomNumber: { $in: roomNumbers } },
        { $set: { status: "occupied" } }
      );
    }

    return res.json({ success: true, booking: created });
  } catch (error) {
    console.error("❌ Error creating booking:", error);
    return res.status(500).json({ success: false, error: "Failed to create booking" });
  }
});

router.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);

    // If empty query => return latest bookings (or you can return [] if you want)
    const filter = {};

    if (q) {
      const isNumberLike = /^[0-9]+$/.test(q);
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); // safe regex

      filter.$or = [
        { bookingId: regex },
        { customerName: regex },
        { status: regex },
        { roomNumbers: regex }, // matches any element in array
      ];

      // Mobile search: exact or partial
      if (isNumberLike) {
        filter.$or.push({ mobile: new RegExp(q, "i") });
      } else {
        filter.$or.push({ mobile: regex });
      }
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      q,
      page,
      limit,
      total,
      items,
    });
  } catch (err) {
    console.error("❌ Search bookings error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});



/* ------------------ PUT UPDATE BOOKING ------------------ */
// ✅ PUT /newapi/bookings/:id   (id = BK0001)
router.put("/:id", async (req, res) => {
  console.log('update data',req.body)
  try {
    const bookingId = req.params.id;
    const body = req.body || {};

    const existing = await Booking.findOne({ bookingId });
    if (!existing) return res.status(404).json({ success: false, error: "Booking not found" });

    // ✅ rooms: prefer normalized array coming from frontend
    const hasRoomsField = ("roomNumbers" in body) || ("Room Number" in body);

const newRooms = hasRoomsField
  ? parseRoomNumbers(body.roomNumbers ?? body["Room Number"])
  : parseRoomNumbers(existing.roomNumbers ?? existing.raw?.["Room Number"] ?? "");

    const oldRooms = parseRoomNumbers(existing.roomNumbers ?? existing.raw?.["Room Number"] ?? "");

    const roomsChanged =
      oldRooms.join(",") !== newRooms.join(",");

    if (roomsChanged) {
      // free old
      if (oldRooms.length) {
        await Room.updateMany({ roomNumber: { $in: oldRooms } }, { $set: { status: "available" } });
      }
      // occupy new
      if (newRooms.length) {
        await Room.updateMany({ roomNumber: { $in: newRooms } }, { $set: { status: "occupied" } });
      }
    }

    // ✅ normalize editable fields (use body, fallback to existing)
    const customerName = body.customerName ?? body["Customer Name"] ?? existing.customerName;
    const mobile = body.mobile ?? body["Mobile"] ?? existing.mobile;

    const checkInDate = body.checkInDate ?? body["Check In"] ?? existing.checkInDate;
    const checkInTime = body.checkInTime ?? body["Check In Time"] ?? existing.checkInTime;
    const checkOutDate = body.checkOutDate ?? body["Check Out"] ?? existing.checkOutDate;

    const status = body.status ?? body["Status"] ?? existing.status;

    const nights = Number(body.nights ?? body["Nights"] ?? existing.nights ?? 1) || 1;
    const roomPricePerNight = Number(body.roomPricePerNight ?? body["Room Price Per Night"] ?? existing.roomPricePerNight ?? 0) || 0;
    const additionalAmount = Number(body.additionalAmount ?? body["Additional Amount"] ?? existing.additionalAmount ?? 0) || 0;

    const roomAmount = roomPricePerNight * nights;
    const totalAmount = roomAmount + additionalAmount;

    // ✅ paid from DB (single source of truth)
    const payDocs = await Payment.find({ bookingId });
    const totalPaid = payDocs.reduce((s, p) => s + Number(p.amount || 0), 0);

    const advance = totalPaid;
    const balance = totalAmount - totalPaid;

    // ✅ raw (keep both excel + normalized keys)
    const raw = { ...(existing.raw || {}), ...(body.raw || {}) };

    raw["Booking ID"] = bookingId;
    raw["Customer Name"] = customerName;
    raw["Mobile"] = mobile;
    raw["Room Number"] = newRooms.length ? newRooms.join(", ") : "TBD";
    raw["Check In"] = checkInDate;
    raw["Check In Time"] = checkInTime;
    raw["Check Out"] = checkOutDate;
    raw["Status"] = status;

    raw["Nights"] = nights;
    raw["Room Price Per Night"] = roomPricePerNight;
    raw["Room Amount"] = roomAmount;
    raw["Additional Amount"] = additionalAmount;
    raw["Total Amount"] = totalAmount;
    raw["Advance"] = advance;
    raw["Balance"] = balance;

    const saved = await Booking.findOneAndUpdate(
      { bookingId },
      {
        customerName,
        mobile,
        roomNumbers: newRooms,
        status,
        checkInDate,
        checkInTime,
        checkOutDate,
        nights,
        roomPricePerNight,
        additionalAmount,
        roomAmount,
        totalAmount,
        advance,
        balance,
        raw,
      },
      { new: true }
    );

    return res.json({ success: true, booking: saved });
  } catch (error) {
    console.error("❌ Error updating booking:", error);
    res.status(500).json({ success: false, error: "Failed to update booking" });
  }
});

/* ------------------ ALLOCATE ROOM TO ADVANCE BOOKING ------------------ */
// ✅ POST /newapi/bookings/:id/allocate-room
// body: { roomNumbers: "101, 102" }
router.post("/:id/allocate-room", async (req, res) => {
  try {
    const bookingId = req.params.id;
    const roomNumbersStr = req.body?.roomNumbers;

    const bookingDoc = await Booking.findOne({ bookingId });
    if (!bookingDoc) return res.status(404).json({ success: false, error: "Booking not found" });

    const raw = { ...(bookingDoc.raw || {}) };

    if ((raw.Status || raw.status) !== "Advance Booking") {
      return res.status(400).json({ success: false, error: "Not an advance booking" });
    }

    // update raw booking fields
    raw["Room Number"] = roomNumbersStr;
    raw.Status = "Confirmed";

    // recompute (keeps safe)
    const computed = computeAmounts(raw);
    const newRooms = parseRoomNumbers(roomNumbersStr);

    // occupy allocated rooms
    if (newRooms.length > 0) {
      await Room.updateMany(
        { roomNumber: { $in: newRooms } },
        { $set: { status: "occupied" } }
      );
    }

    const saved = await Booking.findOneAndUpdate(
      { bookingId },
      {
        roomNumbers: newRooms,
        status: "Confirmed",
        nights: computed.nights,
        roomPricePerNight: computed.roomPricePerNight,
        additionalAmount: computed.additionalAmount,
        roomAmount: computed.roomAmount,
        totalAmount: computed.totalAmount,
        advance: computed.advance,
        balance: computed.balance,
        raw
      },
      { new: true }
    );

    res.json({ success: true, booking: saved.raw });
  } catch (error) {
    console.error("❌ Error allocating room:", error);
    res.status(500).json({ success: false, error: "Failed to allocate room" });
  }
});

/* ------------------ DELETE BOOKING ------------------ */
// ✅ DELETE /newapi/bookings/:id
router.delete("/:id", async (req, res) => {
  try {
    const bookingId = req.params.id;

    const bookingDoc = await Booking.findOne({ bookingId });
    if (!bookingDoc) return res.status(404).json({ success: false, error: "Booking not found" });

    const roomStr = bookingDoc.raw?.["Room Number"] || bookingDoc.raw?.roomNumber || "TBD";
    const roomNumbers = parseRoomNumbers(roomStr);

    // free rooms
    if (roomNumbers.length > 0) {
      await Room.updateMany(
        { roomNumber: { $in: roomNumbers } },
        { $set: { status: "available" } }
      );
    }

    await Booking.deleteOne({ bookingId });

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Error deleting booking:", error);
    res.status(500).json({ success: false, error: "Failed to delete booking" });
  }
});

/* ------------------ CHECKOUT ------------------ */
// ✅ POST /newapi/bookings/:id/checkout
// POST /newapi/bookings/:id/checkout
router.post("/:id/checkout", async (req, res) => {
  try {
    const bookingId = req.params.id;

    const bookingDoc = await Booking.findOne({ bookingId });

    
    if (!bookingDoc) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // ✅ compute paid from DB (not frontend)
    const payments = await Payment.find({ bookingId });
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);

    const balance = Number(bookingDoc.totalAmount || 0) - totalPaid;
    if (balance > 0) {
  return res.status(400).json({
    success: false,
    error: `Pending balance ₹${balance}. Clear payment first.`,
  });
}

    bookingDoc.advance = totalPaid;
    bookingDoc.balance = Number(bookingDoc.totalAmount || 0) - totalPaid;

    const checkoutTime =
  req.body?.checkoutTime ||
  new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });

const checkoutDate =
  req.body?.checkoutDate ||
  new Date().toLocaleDateString("en-GB");
    const raw = { ...(bookingDoc.raw || {}) };
    raw["Check Out Time"] = checkoutTime;
    raw["Check Out Date"] = checkoutDate;
    raw["status"] = "Checked Out"; // keep same key style as your UI uses
    raw["Status"] = "Checked Out";

    // ✅ get rooms
    const roomNumbers =
      (Array.isArray(bookingDoc.roomNumbers) && bookingDoc.roomNumbers.length > 0)
        ? parseRoomNumbers(bookingDoc.roomNumbers)
        : parseRoomNumbers(raw["Room Number"] || raw.roomNumber || "");

    // ✅ free rooms
    if (roomNumbers.length > 0) {
      await Room.updateMany(
        { roomNumber: { $in: roomNumbers } },
        { $set: { status: "available" } }
      );
    }

    // ✅ update booking
    bookingDoc.status = "Checked Out";
    // IMPORTANT: don't clear roomNumbers, otherwise history is lost
    // bookingDoc.roomNumbers = [];
    bookingDoc.raw = raw;

    await bookingDoc.save();

    return res.json({
      success: true,
      checkoutTime,
      checkoutDate,
      freedRooms: roomNumbers,
      booking: bookingDoc,
    });
  } catch (error) {
    console.error("❌ Error during checkout:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to checkout" });
  }
});


module.exports = router;
