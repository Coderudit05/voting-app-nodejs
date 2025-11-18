const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../model/user");

require("dotenv").config();

async function seedAdmin() {
  await mongoose.connect(process.env.MONGO_URL);

  const existingAdmin = await User.findOne({ email: "admin@gmail.com" });

  if (existingAdmin) {
    console.log("Admin already exists");
    return process.exit();
  }

  const hashedPassword = await bcrypt.hash("admin123", 10);

  await User.create({
    name: "Admin",
    email: "admin@gmail.com",
    password: hashedPassword,
    mobile: "9999999999",
    age: 30,
    aadharCardNumber: "000000000000",
    address: "Admin Office",
    role: "admin",
    isVoted: false,
  });

  console.log("Admin created successfully!");
  process.exit();
}

seedAdmin();
