const express = require("express");
const router = express.Router();

const Payment = require("../models/Payments");
const Booking = require("../models/Booking");

// helper: recalc booking balance from payments
async function recalcBookingBalance(bookingId) {
  const booking = await Booking.findOne({ bookingId });
  if (!booking) return null;

  const payments = await Payment.find({ bookingId });
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  booking.advance = totalPaid; // keep advance as "total paid" so UI stays simple
  booking.balance = Number(booking.totalAmount || 0) - totalPaid;

  await booking.save();
  return { booking, totalPaid };
}

// ✅ GET /newapi/payments
router.get("/", async (req, res) => {
  try {
    const docs = await Payment.find().sort({ createdAt: -1 });
    res.json({ success: true, items: docs });
  } catch (err) {
    console.error("❌ payments get:", err);
    res.status(500).json({ success: false, error: "Failed to fetch payments" });
  }
});

// ✅ POST /newapi/payments
router.post("/", async (req, res) => {
  try {
    const raw = req.body || {};

    const paymentId = raw.paymentId || raw["Payment ID"];
    const bookingId = raw.bookingId || raw["Booking ID"];
    const customerName = raw.customerName || raw["Customer Name"] || "";
    const amount = Number(raw.amount ?? raw["Amount"] ?? 0);
    const paymentMode = raw.paymentMode || raw["Payment Mode"] || "";
    const date = raw.date || raw["Date"] || "";
    const time = raw.time || raw["Time"] || "";

    if (!bookingId) return res.status(400).json({ success: false, error: "bookingId is required" });
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: "Valid amount is required" });
    if (!paymentId) return res.status(400).json({ success: false, error: "paymentId is required" });

    // ✅ stop duplicate paymentId
    const already = await Payment.findOne({ paymentId }).lean();
    if (already) {
      return res.status(409).json({ success: false, error: "Duplicate paymentId. Payment already recorded." });
    }

    // ✅ stop overpayment (server-side)
    const booking = await Booking.findOne({ bookingId });
    if (!booking) return res.status(404).json({ success: false, error: "Booking not found" });

    const allPays = await Payment.find({ bookingId });
    const alreadyPaid = allPays.reduce((s, p) => s + Number(p.amount || 0), 0);
    const due = Number(booking.totalAmount || 0) - alreadyPaid;

    if (amount > due) {
      return res.status(400).json({ success: false, error: `Payment exceeds due. Due is ₹${due}.` });
    }

    await Payment.create({
      paymentId,
      bookingId,
      customerName,
      amount,
      paymentMode,
      date,
      time,
      raw,
    });

    const updated = await recalcBookingBalance(bookingId);

    return res.json({
      success: true,
      totalPaid: updated?.totalPaid ?? 0,
      booking: updated?.booking ?? null,
    });
  } catch (err) {
    console.error("❌ payments post:", err);
    return res.status(500).json({ success: false, error: "Failed to add payment" });
  }
});


// ✅ DELETE /newapi/payments/:id  (paymentId)
router.delete("/:id", async (req, res) => {
  try {
    const paymentId = req.params.id;
    const payment = await Payment.findOne({ paymentId });

    if (!payment) {
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    const bookingId = payment.bookingId;

    await Payment.deleteOne({ paymentId });

    // ✅ recalc booking after delete
    await recalcBookingBalance(bookingId);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ payments delete:", err);
    res.status(500).json({ success: false, error: "Failed to delete payment" });
  }
});

module.exports = router;
