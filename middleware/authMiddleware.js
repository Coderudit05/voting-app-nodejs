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

module.exports = { generateToken, jwtAuthMiddleware };
