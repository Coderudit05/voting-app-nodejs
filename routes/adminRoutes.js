const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const User = require("../model/user");
const Candidate = require("../model/candidate");
const {
  generateToken,
  jwtAuthMiddleware,
  adminOnly,
} = require("../middleware/authMiddleware");

// ------------------ ADMIN LOGIN PAGE --------------------
router.get("/login", (req, res) => {
  const error = req.query.error;
  res.render("admin/login", { error });
});

// ------------------ ADMIN LOGIN PROCESS --------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.redirect("/admin/login?error=missing");
    }

    const admin = await User.findOne({ email, role: "admin" }).select(
      "+password"
    );

    if (!admin) {
      return res.redirect("/admin/login?error=invalid");
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.redirect("/admin/login?error=invalid");
    }

    const token = generateToken(admin);
    res.cookie("token", token, { httpOnly: true });

    return res.redirect("/admin/dashboard");
  } catch (err) {
    console.error("Admin Login Error:", err);
    return res.redirect("/admin/login?error=server");
  }
});

// ------------------ ADMIN DASHBOARD --------------------
router.get("/dashboard", jwtAuthMiddleware, adminOnly, async (req, res) => {
  const stats = {
    totalUsers: await User.countDocuments(),
    totalCandidates: await Candidate.countDocuments(),
    totalVotes: await Candidate.aggregate([
      { $group: { _id: null, total: { $sum: "$voteCount" } } },
    ]).then((r) => r[0]?.total || 0),
  };

  res.render("admin/dashboard", { stats });
});

// ------------------ ADD CANDIDATE PAGE --------------------
router.get("/add-candidate-page", jwtAuthMiddleware, adminOnly, (req, res) => {
  res.render("admin/addCandidate");
});

// ------------------ ADD CANDIDATE --------------------
router.post(
  "/add-candidate",
  jwtAuthMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { name, party, age } = req.body;

      if (!name || !party || !age) {
        return res.status(400).send("Name, party, and age required");
      }

      await Candidate.create({ name, party, age, votes: [], voteCount: 0 });

      return res.redirect("/admin/candidates");
    } catch (error) {
      console.log("Candidate Add Error:", error);
      return res.status(500).send("Server error");
    }
  }
);

// ------------------ LIST CANDIDATES --------------------
router.get("/candidates", jwtAuthMiddleware, adminOnly, async (req, res) => {
  const candidates = await Candidate.find();
  res.render("admin/listCandidates", { candidates });
});

// ------------------ ADMIN LOGOUT --------------------
router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.redirect("/admin/login?error=logout");
});

// Now we will create the routes for editing and deleting candidates

// Edit Candidate Page
router.get(
  "/admin/edit-candidate/:id",
  jwtAuthMiddleware,
  adminOnly,
  async (req, res) => {
    const candidate = await Candidate.findById(req.params.id);

    if (!candidate) {
      return res.status(404).send("Candidate not found");
    }

    res.render("admin/editCandidate", { candidate });
  }
);

// 2. Handle Update Form Submission
// Edit Candidate Route
router.post(
  "/admin/update-candidate/:id",
  jwtAuthMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      const { name, party, age } = req.body;

      await Candidate.findByIdAndUpdate(
        req.params.id,
        { name, party, age },
        { new: true, runValidators: true }
      );

      return res.redirect("/admin/candidates?success=updated");
    } catch (error) {
      console.log("Update Candidate Error:", error);
      res.status(500).send("Server error");
    }
  }
);

// 3. Delete Candidate Route

router.post(
  "/admin/delete-candidate/:id",
  jwtAuthMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      await Candidate.findByIdAndDelete(req.params.id);
      return res.redirect("/admin/candidates?success=deleted");
    } catch (error) {
      console.log("Delete Candidate Error:", error);
      res.status(500).send("Server error");
    }
  }
);

// ------------------ BLOCK USER --------------------
router.post(
  "/admin/block-user/:id",
  jwtAuthMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      await User.findByIdAndUpdate(req.params.id, { isBlocked: true });
      return res.redirect("/admin/users?success=blocked");
    } catch (err) {
      console.log("Block User Error:", err);
      return res.redirect("/admin/users?error=server");
    }
  }
);

// ------------------ UNBLOCK USER --------------------
router.post(
  "/admin/unblock-user/:id",
  jwtAuthMiddleware,
  adminOnly,
  async (req, res) => {
    try {
      await User.findByIdAndUpdate(req.params.id, { isBlocked: false });
      return res.redirect("/admin/users?success=unblocked");
    } catch (err) {
      console.log("Unblock User Error:", err);
      return res.redirect("/admin/users?error=server");
    }
  }
);

// Ye code hamne esliye likha hai taaki admin users ki list dekh sake matlab jo log register hue hain wo sab dikhayega admin ko
// List Users Route

router.get("/admin/users", jwtAuthMiddleware, adminOnly, async (req, res) => {
  try {
    const users = await User.find().select("-password");

    const formattedUsers = users.map((u) => ({
      ...u._doc,
      aadharLast4: u.aadharCardNumber.slice(-4),
    }));

    // Read success/error messages from query params
    const success = req.query.success;
    const error = req.query.error;

    res.render("admin/listUsers", {
      users: formattedUsers,
      success,
      error,
    });
  } catch (err) {
    console.log("Admin User List Error:", err);
    res.status(500).send("Server error");
  }
});



// ------------------ VOTE LOGS --------------------

router.get("/admin/vote-logs", jwtAuthMiddleware, adminOnly, async (req, res) => {
  try {
    const candidates = await Candidate.find()
      .populate("votes.user", "name email mobile")
      .sort({ name: 1 });

    res.render("admin/voteLogs", { candidates });
  } catch (err) {
    console.log("Vote Log Error:", err);
    res.status(500).send("Server Error");
  }
});


module.exports = router;
