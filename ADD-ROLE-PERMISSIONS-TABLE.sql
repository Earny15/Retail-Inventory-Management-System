-- =====================================================
-- AluminiumPro - Role Permissions Table
-- RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  module VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role_id, module)
);

-- Enable RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read role_permissions
CREATE POLICY "Authenticated users can read role_permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert role_permissions
CREATE POLICY "Authenticated users can insert role_permissions"
  ON role_permissions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update role_permissions
CREATE POLICY "Authenticated users can update role_permissions"
  ON role_permissions FOR UPDATE
  TO authenticated
  USING (true);

-- Allow authenticated users to delete role_permissions
CREATE POLICY "Authenticated users can delete role_permissions"
  ON role_permissions FOR DELETE
  TO authenticated
  USING (true);
