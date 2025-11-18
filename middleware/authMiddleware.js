const jwt = require("jsonwebtoken");
require("dotenv").config();

// Generate JWT token
function generateToken(user) {
  const payload = {
    id: user._id,
    role: user.role,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
}

// Middleware to protect routes using JWT
function jwtAuthMiddleware(req, res, next) {
  try {
    let token;

    // 1. Check Authorization header (Postman)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    // 2. Check Cookie (Browser/EJS)
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // 3. If token not found in either place → unauthorized
    if (!token) {
      return res.status(401).json({ message: "No token provided" });
    }

    // 4. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 5. Attach user data to req.user
    req.user = decoded;

    next();
  } catch (error) {
    console.error("JWT Error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}


// Ye middleware hamne esliye lagaya hai taaki agar koi authenticated user login page par jaye toh ham usko profile page par redirect kar de
// Kyuke login page sirf unauthenticated users kai liye hona chahiye so if authenticated user tries to access login page -> redirect to profile page

// redirectIfAuthenticated: if token valid -> redirect to profile page (for EJS)
/**
 * ----------------------------------------------------------------------
 *  redirectIfAuthenticated
 *  --> Yeh middleware ensure karta hai ki agar user already login hai,
 *      toh wo login ya signup pages ko WAPAS na dekh paye.
 *      Instead: Usko directly profile page par redirect kiya jata hai.
 * ----------------------------------------------------------------------
 */
function redirectIfAuthenticated(req, res, next) {
  try {
    let token;

    // Authorization header se token check
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    // Cookie se token check
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    // Agar token present hai → user shayad logged in ho sakta hai
    if (token) {
      try {
        // Token verify karna zaruri hai (invalid token hone par login page allow kar denge)
        jwt.verify(token, process.env.JWT_SECRET);

        // Agar verification successful → user logged-in hai
        return res.redirect("/api/v1/profile-page");
      } catch (err) {
        // Token invalid hai → user ko login karne denge
        return next();
      }
    }

    // Agar token hi nahi hai → user logged-in nahi hai → page access allowed
    return next();
  } catch (err) {
    // Kisi unexpected error par bhi hum login page allow kar denge
    return next();
  }
}

// ********************* Admin Middleware ************************************************************************************
// Making an Admin Only Middleware so that only admin can access certain routes

function adminOnly(req, res, next) {
  // JWT middleware ne token decode karke req.user me user ka data store kar diya hota hai.
  if (!req.user) {
    return res.status(401).send("Not authenticated");
  }

  // Check if role = admin
  if (req.user.role !== "admin") {
    return res.status(403).send("Access Denied: Admin only");
  }

  next(); // Allow request to continue
}
module.exports = { generateToken, jwtAuthMiddleware, redirectIfAuthenticated, adminOnly };

// Exporting all middlewares