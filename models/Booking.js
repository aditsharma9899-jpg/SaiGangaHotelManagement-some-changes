const mongoose = require("mongoose");

const foodItemSchema = new mongoose.Schema(
  {
    name: String,
    quantity: Number,
    price: Number,
    total: Number,
  },
  { _id: false }
);
const cartItemSchema = new mongoose.Schema(
  {
    foodId: { type: String, default: "" }, // FOOD0001 (optional but good)
    name: { type: String, default: "" },
    price: { type: Number, default: 0 },
    quantity: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);


const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, index: true },

    // keep these normalized fields for searching
    customerName: { type: String, default: "" },
    mobile: { type: String, default: "" },

    roomNumbers: { type: [String], default: [] },
    status: { type: String, default: "" },

    checkInDate: { type: String, default: "" },
checkInTime: { type: String, default: "" },
checkOutDate: { type: String, default: "" },

    nights: { type: Number, default: 1 },
    roomPricePerNight: { type: Number, default: 0 },
    additionalAmount: { type: Number, default: 0 },
    roomAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    foodOrders: { type: [foodItemSchema], default: [] },
    cart: { type: [foodItemSchema], default: [] },
    draftCart: { type: [cartItemSchema], default: [] },
draftCartUpdatedAt: { type: Date },

    // ✅ store full original bookingData also (so no UI breaks)
    raw: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Booking", bookingSchema);
