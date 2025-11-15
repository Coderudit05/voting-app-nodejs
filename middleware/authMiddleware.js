const jwt = require("jsonwebtoken");
require("dotenv").config();

// Generate JWT token

function generateToken(user) {
  // here we are creating payload with user id and role
  const payload = {
    id: user._id,
    role: user.role,
  };

  // Description for this return statement:
  // It creates a JWT token by signing the payload with a secret key from the environment variables.
  // The token will expire based on the configured expiration time or default to 1 day.

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d", // that means 1 day
  });
}

// Middleware to protect routes using JWT

function jwtAuthMiddleware(req, res, next) {
  try {
    // 1. Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      //
      return res.status(401).json({ message: "No token provided" });
    }
    // now we will extract the token
    const token = authHeader.split(" ")[1]; // that means we are splitting the string by space and getting the second part which is the token

    // Now we will verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // that means we are verifying the token with the secret key

    req.user = decoded; // attaching decoded payload to req.user for further use in routes
    next(); // proceed to the next middleware or route handler
  } catch (error) {
    console.error("JWT Error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}



module.exports = { generateToken, jwtAuthMiddleware };
