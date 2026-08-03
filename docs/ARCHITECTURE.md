# Architecture Documentation

## Session Management Strategy

### Current Implementation: JWT (JSON Web Tokens)

CreatorOs uses **JWT tokens** for session management instead of Express's default MemoryStore or server-side session storage.

#### Why JWT?

1. **Scalability**: JWT tokens are stateless and don't require server-side storage, enabling horizontal scaling
2. **Memory Efficiency**: No unbounded session store growth (prevents OOM in production)
3. **Microservices Ready**: Each service can verify tokens independently without session synchronization
4. **Security**: Cryptographically signed tokens cannot be tampered with
5. **Mobile/SPA Friendly**: Works seamlessly with frontend frameworks and mobile apps

#### Implementation Details

- **Token Generation**: Created in `controller/auth.js` using `jwt.sign()`
- **Token Storage**: Stored in HTTP-only cookies (secure by default)
- **Token Verification**: Middleware validates token signature on protected routes
- **Token Expiry**: Configurable expiration time (typically 7-30 days)
- **Payload**: Contains user ID, email, role, and password change timestamp

#### Security Measures

✅ **HTTP-Only Cookies**: Prevents XSS attacks from accessing tokens  
✅ **Secure Flag**: Cookies transmitted only over HTTPS in production  
✅ **SameSite Policy**: CSRF protection with Strict mode  
✅ **Token Signing**: Using JWT_SECRET environment variable  
✅ **Password Change Tracking**: Invalidates tokens if password changed

#### Code Locations

- **Token Generation**: `controller/auth.js:74-82` (handleGoogleCallback), `controller/auth.js:286-298` (login)
- **Token Verification**: `middleware/auth.js` (protect middleware)
- **Cookie Configuration**: `index.js:587-592` (res.cookie options)

#### Why Not MemoryStore?

The default Express session store (`express-session` with MemoryStore) has critical limitations:

- **Memory Leak**: Sessions accumulate in memory indefinitely without cleanup
- **Not Distributed**: Can't share sessions across multiple server instances
- **Production Risk**: OOM crashes under load with many concurrent users
- **Development-Only**: Recommended only for development environments

CreatorOs solves this with stateless JWT tokens instead.

#### Monitoring

Monitor the following to ensure session security:

1. **Token Generation Rate**: Should correlate with login attempts
2. **Token Validation Failures**: Monitor middleware for expired/invalid tokens
3. **Cookie Transmission**: Verify Secure + HttpOnly flags in production
4. **Token Leaks**: Watch for tokens appearing in logs or error messages

#### Future Improvements

- [ ] Token refresh rotation (issue new token before expiry)
- [ ] Token revocation list (for immediate logout across all devices)
- [ ] Device fingerprinting (bind tokens to device IDs)
- [ ] Audit logging (track all token validations and failures)
