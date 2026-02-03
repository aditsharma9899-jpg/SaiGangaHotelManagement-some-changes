const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    await mongoose.connect('mongodb+srv://aditsharma9899_db_user:1234567890@cluster0.edrio4b.mongodb.net/?appName=Cluster0');
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("❌ MongoDB connection failed", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
