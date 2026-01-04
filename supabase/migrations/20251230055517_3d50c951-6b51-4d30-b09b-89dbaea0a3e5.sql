-- Clean all data from the database
-- Order matters due to foreign key constraints

-- First delete data from child tables
DELETE FROM payroll_entries;
DELETE FROM payroll_runs;
DELETE FROM performance_reviews;
DELETE FROM leave_requests;
DELETE FROM leave_types;
DELETE FROM time_entries;
DELETE FROM employee_documents;
DELETE FROM document_types;
DELETE FROM candidates;
DELETE FROM jobs;
DELETE FROM employees;
DELETE FROM departments;
DELETE FROM audit_logs;
DELETE FROM security_events;
DELETE FROM support_access;
DELETE FROM company_subscriptions;
DELETE FROM company_users;
DELETE FROM companies;
DELETE FROM platform_admins;
DELETE FROM profiles;

-- Also delete auth users (this needs to be done via admin API, but we can try)
-- Note: This may not work due to permissions, but the profiles delete should cascade