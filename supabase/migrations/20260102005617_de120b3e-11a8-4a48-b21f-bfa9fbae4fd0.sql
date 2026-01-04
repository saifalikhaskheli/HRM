-- Insert default permissions for my_team module
INSERT INTO permissions (module, action, name, description)
VALUES 
  ('my_team', 'read', 'my_team.read', 'View team members and their status'),
  ('my_team', 'approve', 'my_team.approve', 'Approve leave requests and expenses from team'),
  ('my_team', 'manage', 'my_team.manage', 'Manage team assignments and settings')
ON CONFLICT (module, action) DO NOTHING;