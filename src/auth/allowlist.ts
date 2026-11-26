/**
 * Who can sign in now lives in the database (the app_users table), managed from
 * Settings by admins; see access.ts. This file only names the roles.
 */
export type UserRole = 'admin' | 'viewer';
