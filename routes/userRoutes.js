const express = require("express");
const router = express.Router();
const User = require("../model/user");
const bcrypt = require("bcrypt");
require("dotenv").config();
const {
  generateToken,
  jwtAuthMiddleware,
} = require("../middleware/authMiddleware");

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

// POST /signup
router.post("/signup", async (req, res) => {
  try {
    const { name, age, email, mobile, password, aadharCardNumber, address } =
      req.body;

    // 1. Basic validation
    if (
      !name ||
      !age ||
      !email ||
      !mobile ||
      !password ||
      !aadharCardNumber ||
      !address
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // 2. Duplicate check for email, mobile, aadhar
    const existingUser = await User.findOne({
      $or: [{ email }, { mobile }, { aadharCardNumber }],
    });

    if (existingUser) {
      return res
        .status(409)
        .json({
          message: "User with this email/mobile/aadhaar already exists",
        });
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 4. Create new user with hashed password
    const newUser = await User.create({
      name,
      age,
      email,
      mobile,
      password: hashedPassword,
      aadharCardNumber,
      address,
      role: "voter", // ensure no admin signup
    });

    // 5. Prepare safe response (never return password)
    const safeUser = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      mobile: newUser.mobile,
      role: newUser.role,
    };

    res.status(201).json({
      message: "Signup successful",
      user: safeUser,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ****************** Login Route *******************************************************************

// POST /login
// POST /login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Step 1: Validate
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    // Step 2: Find user (include password explicitly)
    const user = await User.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Step 3: Compare password using bcrypt
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Step 4: Generate JWT token
    const token = generateToken(user);

    // Step 5: Prepare safe user object
    const safeUser = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    res.json({
      message: "Login successful",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ****************** Profile Route *******************************************************************

// GET /profile

router.get("/profile", jwtAuthMiddleware, async (req, res) => {
  try {
    // Step 1: Get user ID from req.user
    const userId = req.user.id;

    // Step 2: Fetch user details excluding password
    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Step 3: Mask aadharCardNumber that means show only last 4 digits
    const maskAadhar = "************" + user.aadharCardNumber.slice(-4);

    const profile = {
      id: user._id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      address: user.address,
      aadharLast4: user.aadharCardNumber.slice(-4),
      role: user.role,
      isVoted: user.isVoted,
    };

    res.json({ profile });
  } catch (error) {
    console.log("Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
