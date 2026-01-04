-- Clean up test platform admin data
DELETE FROM platform_admins WHERE user_id = '4ede5a6b-9a48-4d17-99e1-6d571984941f';

-- Clean up the test profile (optional, keeps auth user but removes profile)
DELETE FROM profiles WHERE id = '4ede5a6b-9a48-4d17-99e1-6d571984941f';