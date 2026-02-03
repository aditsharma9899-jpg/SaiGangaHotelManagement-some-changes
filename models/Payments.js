const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true, required: true },
    bookingId: { type: String, required: true, index: true },

    customerName: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    paymentMode: { type: String, default: "" },

    date: { type: String, default: "" }, // "DD/MM/YYYY"
    time: { type: String, default: "" },

    raw: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);


