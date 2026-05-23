// middleware/auth.js

module.exports = (req, res, next) => {
  // TEMPORARY FIX: Since we don't have a real login system yet,
  // we are mocking a user so the dashboard can load.
  
  if (!req.user) {
    req.user = { 
      _id: '654321abcdef1234567890ab' // Fake MongoDB ID format
    };
  }
  
  next(); // Allow the request to proceed
};