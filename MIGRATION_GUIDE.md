# Migration Guide: Supabase to Coolify PostgreSQL

This guide will help you migrate your SafeSense application from Supabase to Coolify PostgreSQL.

## Overview

The migration involves:
1. Replacing Supabase client with Prisma ORM
2. Implementing custom JWT-based authentication
3. Updating all API routes to use PostgreSQL queries
4. Setting up the database schema

## Prerequisites

- Node.js installed
- Access to your Coolify PostgreSQL database
- Your database connection details

## Step 1: Environment Setup

Create a `.env.local` file in your project root with your Coolify PostgreSQL connection details:

```bash
# Primary connection string (use this in your app/ORM)
DATABASE_URL="postgres://postgres:oTj0MHpzEl24RUp6bfDuuY5gwdNbB3jgM29iIaYNrMVlHZYE4V3PwGu0b1g9s6j2@161.97.170.64:5400/postgres"

# If you're using Prisma, it prefers the "postgresql://" scheme:
PRISMA_DATABASE_URL="postgresql://postgres:oTj0MHpzEl24RUp6bfDuuY5gwdNbB3jgM29iIaYNrMVlHZYE4V3PwGu0b1g9s6j2@161.97.170.64:5400/postgres"

# Breakout vars (useful for psql, node-postgres, etc.)
PGHOST=161.97.170.64
PGPORT=5400
PGUSER=postgres
PGPASSWORD=oTj0MHpzEl24RUp6bfDuuY5gwdNbB3jgM29iIaYNrMVlHZYE4V3PwGu0b1g9s6j2
PGDATABASE=postgres
PGSSLMODE=disable

# JWT Secret for authentication (change this in production!)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## Step 2: Install Dependencies

Install the new dependencies and remove Supabase:

```bash
# Install new dependencies
npm install jsonwebtoken

# Remove Supabase (optional, you can keep it for now)
npm uninstall @supabase/supabase-js
```

## Step 3: Database Setup

1. **Generate Prisma client:**
   ```bash
   npm run db:generate
   ```

2. **Push the schema to your database:**
   ```bash
   npm run db:push
   ```

3. **Run the migration script:**
   ```bash
   npm run db:migrate
   ```

## Step 4: Data Migration (if needed)

If you have existing data in Supabase that you need to migrate:

1. Export your data from Supabase
2. Transform the data to match the new schema
3. Import the data into your Coolify PostgreSQL database

## Step 5: Update Frontend Authentication

The frontend authentication has been updated to work with the new system. The main changes are:

1. **Login/Signup:** Now uses custom JWT authentication
2. **API Client:** Updated to use JWT tokens instead of Supabase sessions
3. **Token Storage:** Tokens are stored in both localStorage and HTTP-only cookies

## Step 6: Test the Migration

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Test the following features:**
   - User registration
   - User login
   - Sensor data retrieval
   - User preferences
   - Sensor readings
   - Team invitations (if implemented)

## Key Changes Made

### Database Schema
- Created Prisma schema with all necessary tables
- Mapped Supabase auth.users to custom User model
- Maintained all existing relationships and constraints

### Authentication
- Replaced Supabase Auth with custom JWT-based authentication
- Implemented password hashing with bcrypt
- Added JWT token generation and verification

### API Routes
- Updated all API routes to use Prisma instead of Supabase client
- Maintained the same API interface for frontend compatibility
- Added proper error handling and logging

### Database Client
- Created a comprehensive DatabaseClient class
- Implemented all necessary database operations
- Added permission checking methods

## Troubleshooting

### Common Issues

1. **Database Connection Errors:**
   - Verify your connection string is correct
   - Check if your Coolify PostgreSQL instance is running
   - Ensure the database exists and is accessible

2. **Authentication Issues:**
   - Check if JWT_SECRET is set in your environment
   - Verify token generation and verification logic
   - Check browser console for token-related errors

3. **Schema Issues:**
   - Run `npm run db:push` to sync your schema
   - Check Prisma logs for any schema conflicts
   - Verify all required tables are created

### Debugging

1. **Enable Prisma logging:**
   ```javascript
   const prisma = new PrismaClient({
     log: ['query', 'info', 'warn', 'error'],
   });
   ```

2. **Check database connection:**
   ```bash
   npx prisma db pull
   ```

3. **View database in Prisma Studio:**
   ```bash
   npx prisma studio
   ```

## Rollback Plan

If you need to rollback to Supabase:

1. Revert the changes to API routes
2. Restore the original Supabase client configuration
3. Update the frontend to use Supabase authentication again
4. Restore the original environment variables

## Production Considerations

1. **Security:**
   - Use a strong, unique JWT_SECRET
   - Enable HTTPS in production
   - Consider implementing refresh tokens
   - Add rate limiting to authentication endpoints

2. **Performance:**
   - Add database indexes for frequently queried fields
   - Implement connection pooling
   - Consider caching for frequently accessed data

3. **Monitoring:**
   - Add logging for authentication events
   - Monitor database performance
   - Set up error tracking

## Support

If you encounter issues during migration:

1. Check the console logs for error messages
2. Verify your database connection
3. Ensure all environment variables are set correctly
4. Check the Prisma documentation for schema-related issues

## Next Steps

After successful migration:

1. Update your deployment configuration
2. Set up monitoring and logging
3. Consider implementing additional security measures
4. Plan for database backups and maintenance
