const express = require("express");
const router = express.Router();
const User = require("../model/user");
const bcrypt = require("bcrypt");

const Candidate = require("../model/candidate");

require("dotenv").config();
const {
  generateToken,
  jwtAuthMiddleware,
  redirectIfAuthenticated,
} = require("../middleware/authMiddleware");

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

// ****************** Signup Route *******************************************************************

// render signup page — do not allow if already logged-in
router.get("/signup-page", redirectIfAuthenticated, (req, res) => {
  res.render("signup");
});

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
      return res.status(409).json({
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

    return res.redirect("/api/v1/login-page?success=signup");
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ****************** Login Route *******************************************************************

// render login page — do not allow if already logged-in
router.get("/login-page", redirectIfAuthenticated, (req, res) => {
  const success = req.query.success;
  const blocked = req.query.blocked;   // add this
  res.render("login", { success, blocked });
});


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

    // Check if user is blocked
    if (user.isBlocked) {
      return res.redirect("/api/v1/login-page?blocked=true");
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

    res.cookie("token", token, { httpOnly: true }); // Create a cookie named 'token' with the JWT token value

    return res.redirect("/api/v1/profile-page?success=login");
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ****************** Profile Route *******************************************************************

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

// yaha par ham profile page render kar rahe hain jisme user ki details hongi and agar user valid hai toh ham usko profile page par le jayenge
router.get("/profile-page", jwtAuthMiddleware, async (req, res) => {
  const success = req.query.success; // ?success=login
  const updated = req.query.updated; // ?updated=true

  const user = await User.findById(req.user.id);
  const masked = user.aadharCardNumber.slice(-4);

  res.render("profile", {
    success,
    updated,
    user: {
      ...user._doc,
      aadharLast4: masked,
    },
  });
});

// ****************** Update Profile *******************************************************************

// Jab user profile update krne kai liye jayega toh ye page par render hoga which is updateProfile.ejs

router.get("/update-profile", jwtAuthMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    return res.status(404).send("User not found");
  }

  res.render("updateProfile", { user });
});

// PATCH /profile/update - Update user details
router.post("/profile/update", jwtAuthMiddleware, async (req, res) => {
  try {
    // Step 1: Get user ID from req.user
    const userId = req.user.id;

    // Step 2: Validate allowed updates means only these fields can be updated
    const allowedUpdates = ["name", "age", "mobile", "address"];

    // Step 3: Build update object so that only allowed fields are updated
    const updates = {};

    // Build update object safely
    // Ye loop ka matlab hai ki hum allowedUpdates array ke har field ke liye check kar rahe hain ki kya wo req.body mein hai.
    // Agar hai, to hum us field ko updates object mein add kar rahe hain with its new value.
    allowedUpdates.forEach((field) => {
      if (req.body[field]) {
        updates[field] = req.body[field];
      }
    });

    // If nothing to update that means user must provide at least one valid field to update
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    // Step 4: Update user in DB

    // Iska matlab hai ki hum User model ka use karke user ko uske ID se dhundh rahe hain aur uske fields ko updates object ke hisab se update kar rahe hain.
    // { new: true } ka matlab hai ki hum updated document ko return karna chahte hain.
    // { runValidators: true } ka matlab hai ki hum chahte hain ki Mongoose schema validators ko update ke dauran chalaya jaye.
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true } // only modify the specified fields and enture updated data follows schema rules
    );

    // Step 5: Send response to client if user not found then send 404
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // mask aadhar for response
    const maskedAadhar = updatedUser.aadharCardNumber.slice(-4);

    // Here we will update the profile object to send back the updated user details to the client
    // only those fields jo hamne modify kiye hain wo hi update honge response mein baki sab waise ke waise rahenge old values ke saath

    const profile = {
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      mobile: updatedUser.mobile,
      address: updatedUser.address,
      aadharLast4: maskedAadhar,
      role: updatedUser.role,
      isVoted: updatedUser.isVoted,
    };

    return res.redirect("/api/v1/profile-page?updated=true");
  } catch (error) {
    console.log("Update Profile Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// ****************** Logout Route *******************************************************************

router.get("/logout", (req, res) => {
  res.clearCookie("token"); // delete the token cookie
  return res.redirect("/api/v1/login-page?success=logout");
});

// **************** Show all candidates to users ****************************************

router.get("/candidates", jwtAuthMiddleware, async (req, res) => {
  try {
    // fetch candidates
    const candidates = await Candidate.find();

    // fetch full user from DB so we have isVoted and other fields (NOT just req.user)
    const user = await User.findById(req.user.id).select("-password");

    // read query params for messages
    const success = req.query.success;
    const error = req.query.error;

    // render and pass user, candidates and messages
    res.render("candidates", {
      candidates,
      user,
      success,
      error,
    });
  } catch (error) {
    console.log("Candidate List Error:", error);
    res.status(500).send("Server error");
  }
});

// ****************** VOTE ROUTE *******************************************************************

// When user votes for a candidate so ye route hit hoga and vote process hoga and fir redirect kar dega candidates page par with success or error message
router.post("/vote/:candidateId", jwtAuthMiddleware, async (req, res) => {
  try {
    //  Get user ID and candidate ID
    const userId = req.user.id;
    const candidateId = req.params.candidateId;

    // Step 1: User detail fetch
    const user = await User.findById(userId);

    // Step 2: Check if already voted
    if (user.isVoted) {
      return res.redirect("/api/v1/candidates?error=already_voted");
    }

    // Step 3: Candidate fetch
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) {
      return res.redirect("/api/v1/candidates?error=candidate_not_found");
    }

    // Step 4: Add vote to candidate's votes array
    candidate.votes.push({
      user: userId,
      votedAt: new Date(),
    });

    // Step 5: Increase vote count
    candidate.voteCount += 1;

    // Step 6: Save updated candidate
    await candidate.save();

    // Step 7: Update user voted status
    user.isVoted = true;
    await user.save();

    // Step 8: Redirect back with success message
    return res.redirect("/api/v1/candidates?success=voted");
  } catch (error) {
    console.log("Vote Error:", error);
    return res.redirect("/api/v1/candidates?error=server_error");
  }
});


// **************** RESULTS PAGE (rendered) ************************************
router.get("/results", jwtAuthMiddleware, async (req, res) => {
  try {
    // 1) fetch all candidates, sorted by voteCount desc (highest first)
    const candidates = await Candidate.find().sort({ voteCount: -1 });

    // 2) compute total votes across all candidates
    const totalVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);

    // 3) fetch full user for any UI logic (optional)
    const user = await User.findById(req.user.id).select("-password");

    // 4) render the results page with required data
    res.render("results", {
      candidates,
      totalVotes,
      user
    });
  } catch (err) {
    console.error("Results page error:", err);
    res.status(500).send("Server error");
  }
});


// **************** RESULTS DATA API (json) ************************************
router.get("/results-data", jwtAuthMiddleware, async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ voteCount: -1 });

    const totalVotes = candidates.reduce((sum, c) => sum + (c.voteCount || 0), 0);

    // create minimal objects for client (avoid sending full documents)
    const data = candidates.map(c => ({
      id: c._id,
      name: c.name,
      party: c.party,
      votes: c.voteCount || 0,
      // percent computed at client or server
      percent: totalVotes === 0 ? 0 : ((c.voteCount || 0) / totalVotes * 100)
    }));

    return res.json({ totalVotes, candidates: data });
  } catch (err) {
    console.error("Results data error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


module.exports = router;
