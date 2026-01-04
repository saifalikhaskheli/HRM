-- Clean up the test user created during admin check
DELETE FROM platform_admins WHERE user_id = '2b615830-24d2-40a1-be66-b27664b20dea';
DELETE FROM profiles WHERE id = '2b615830-24d2-40a1-be66-b27664b20dea';