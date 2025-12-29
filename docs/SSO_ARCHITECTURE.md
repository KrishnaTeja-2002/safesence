# SSO (Single Sign-On) Architecture Planning

## Overview
This document outlines the planned architecture for implementing SSO authentication (Google, Apple, etc.) in the SafeSense application. This is a planning document only - implementation will be done in a future phase.

## Goals
- Allow users to sign in with their Google/Apple/Microsoft accounts
- Maintain unified authentication system (no separate user/organization flows)
- Preserve existing email/password authentication
- Seamless integration with current OTP-based signup flow

## Architecture Components

### 1. SSO Provider Integration

#### Google OAuth 2.0
- **Provider**: Google Identity Services
- **Flow**: Authorization Code Flow with PKCE
- **Scopes**: `openid`, `email`, `profile`
- **Endpoints**:
  - Authorization: `https://accounts.google.com/o/oauth2/v2/auth`
  - Token: `https://oauth2.googleapis.com/token`
  - User Info: `https://www.googleapis.com/oauth2/v2/userinfo`

#### Apple Sign In
- **Provider**: Apple Identity Services
- **Flow**: Authorization Code Flow
- **Scopes**: `name`, `email`
- **Endpoints**:
  - Authorization: `https://appleid.apple.com/auth/authorize`
  - Token: `https://appleid.apple.com/auth/token`

#### Microsoft Azure AD
- **Provider**: Microsoft Identity Platform
- **Flow**: Authorization Code Flow with PKCE
- **Scopes**: `openid`, `email`, `profile`
- **Endpoints**: Azure AD tenant-specific

### 2. Database Schema Extensions

```sql
-- Add SSO provider info to auth.users
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS sso_provider_id VARCHAR(255);
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS sso_metadata JSONB;

-- Index for SSO lookups
CREATE INDEX IF NOT EXISTS idx_users_sso_provider_id 
ON auth.users(sso_provider, sso_provider_id) 
WHERE sso_provider IS NOT NULL;
```

### 3. API Endpoints Structure

```
POST /api/auth/sso/initiate
  - Initiates SSO flow
  - Body: { provider: 'google' | 'apple' | 'microsoft' }
  - Response: { authUrl: string, state: string, codeVerifier: string }

GET /api/auth/sso/callback
  - Handles SSO callback
  - Query params: { code, state, provider }
  - Response: { token: string, user: object }

POST /api/auth/sso/link
  - Links SSO account to existing email/password account
  - Body: { provider, providerId, email, password }
  - Response: { success: boolean }
```

### 4. Frontend Components

#### SSO Button Component
```jsx
<SSOButton 
  provider="google" 
  onSuccess={(token) => handleSSOLogin(token)}
  onError={(error) => handleError(error)}
/>
```

#### SSO Callback Handler
- Handles redirect from SSO provider
- Exchanges authorization code for tokens
- Creates or links user account
- Redirects to dashboard

### 5. Authentication Flow

#### New User SSO Signup
1. User clicks "Sign in with Google"
2. Redirected to Google OAuth consent screen
3. User authorizes application
4. Google redirects back with authorization code
5. Backend exchanges code for tokens
6. Backend fetches user info from Google
7. Backend creates user account in `auth.users`
8. Backend generates JWT token
9. User logged in and redirected to dashboard

#### Existing User SSO Login
1. User clicks "Sign in with Google"
2. Same OAuth flow as above
3. Backend finds existing user by email
4. Backend links SSO provider to account (if not already linked)
5. Backend generates JWT token
6. User logged in

#### Linking SSO to Existing Account
1. User logs in with email/password
2. User goes to Settings > Security
3. User clicks "Link Google Account"
4. OAuth flow initiated
5. On success, SSO provider linked to account
6. User can now use either email/password or SSO

### 6. Security Considerations

#### State Parameter
- Generate cryptographically secure random state
- Store in session/cookie with short expiry
- Verify state on callback to prevent CSRF

#### PKCE (Proof Key for Code Exchange)
- Generate `code_verifier` (random string)
- Generate `code_challenge` (SHA256 hash)
- Send `code_challenge` in authorization request
- Send `code_verifier` in token exchange
- Prevents authorization code interception

#### Token Storage
- Store SSO provider tokens securely (encrypted)
- Use refresh tokens for long-lived sessions
- Implement token rotation

#### Account Linking Security
- Require password verification before linking
- Send email notification when SSO linked
- Allow unlinking with password verification

### 7. User Experience

#### Signup Flow
- User sees "Sign up with Google" button
- One-click signup (no email verification needed for SSO)
- Account created immediately
- User redirected to dashboard

#### Login Flow
- User sees "Sign in with Google" button
- One-click login
- If new device detected, may require OTP (optional for SSO)
- User redirected to dashboard

#### Account Management
- Settings page shows linked SSO providers
- User can link/unlink providers
- User can set primary authentication method

### 8. Implementation Phases

#### Phase 1: Google OAuth (Priority)
- Implement Google OAuth 2.0
- Test signup and login flows
- Handle account creation and linking

#### Phase 2: Apple Sign In
- Implement Apple Sign In
- Handle Apple-specific requirements (name may be null on subsequent logins)
- Test on iOS devices

#### Phase 3: Microsoft Azure AD
- Implement Microsoft OAuth
- Support both personal and organizational accounts
- Handle tenant-specific configurations

#### Phase 4: Enhanced Features
- Multi-provider linking
- SSO as primary authentication
- Device trust for SSO (skip OTP for trusted devices)

### 9. Code Structure

```
lib/
  sso/
    google.js          # Google OAuth implementation
    apple.js           # Apple Sign In implementation
    microsoft.js       # Microsoft OAuth implementation
    base.js            # Base SSO class with common logic
    utils.js           # SSO utility functions

src/app/api/auth/
  sso/
    initiate/
      route.js         # Initiate SSO flow
    callback/
      route.js         # Handle SSO callback
    link/
      route.js         # Link SSO to account
    unlink/
      route.js         # Unlink SSO from account

components/
  SSOButton.jsx        # Reusable SSO button component
  SSOCallback.jsx      # Handle SSO redirect callback
```

### 10. Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/sso/callback?provider=google

# Apple Sign In
APPLE_CLIENT_ID=your-service-id
APPLE_TEAM_ID=your-team-id
APPLE_KEY_ID=your-key-id
APPLE_PRIVATE_KEY=your-private-key
APPLE_REDIRECT_URI=https://your-domain.com/api/auth/sso/callback?provider=apple

# Microsoft Azure AD
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=your-tenant-id
MICROSOFT_REDIRECT_URI=https://your-domain.com/api/auth/sso/callback?provider=microsoft
```

### 11. Testing Strategy

#### Unit Tests
- SSO token exchange
- User account creation/linking
- State verification
- PKCE validation

#### Integration Tests
- Full OAuth flow
- Account linking scenarios
- Error handling (invalid tokens, expired codes)
- Multi-provider scenarios

#### Security Tests
- CSRF protection
- Authorization code interception
- Token storage security
- Account takeover prevention

## Notes

- SSO users will have `is_sso_user = true` in `auth.users`
- SSO users may not have `encrypted_password` (null is acceptable)
- Email verification is automatic for SSO (provider verifies email)
- Device tracking still applies to SSO logins
- OTP for new devices is optional for SSO (can be configured)

## Future Enhancements

1. **Social Account Merging**: Allow merging multiple SSO accounts
2. **Enterprise SSO**: Support SAML 2.0 for enterprise customers
3. **Magic Links**: Passwordless email-based authentication
4. **Biometric Auth**: WebAuthn/FIDO2 support
5. **Multi-Factor Auth**: TOTP apps for SSO accounts

