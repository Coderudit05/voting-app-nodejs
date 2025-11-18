require("dotenv").config();
const express = require("express");
const app = express();


// ********************************************************
// Importing User and Admin Routes
const userRoutes = require("./routes/userRoutes");
const adminRoutes = require("./routes/adminRoutes");
// ********************************************************

const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

// telling express to user ejs as view engine
app.set("view engine", "ejs");

const MONGO_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/votingApp";
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("DB Error:", err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// They are for the user routes
app.use("/api/v1", userRoutes);

app.get("/", (req, res) => {
  res.render("login");
});

// They are for the admin routes

app.use("/admin", adminRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
