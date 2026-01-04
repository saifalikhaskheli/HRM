/**
 * Authentication hook - re-exports from AuthContext
 * Provides type-safe access to authentication state and actions
 * 
 * SECURITY NOTE: This hook reflects backend-enforced state.
 * All authorization checks are verified server-side via RLS and SQL functions.
 */
export { useAuth } from '@/contexts/AuthContext';
