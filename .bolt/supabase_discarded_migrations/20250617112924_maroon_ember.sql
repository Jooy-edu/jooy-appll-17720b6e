/*
  # Create worksheets and regions schema

  1. New Tables
    - `worksheets`
      - `id` (text, primary key) - worksheet identifier (e.g., "ABCDE")
      - `document_name` (text) - name of the PDF document
      - `document_id` (uuid) - unique document identifier
      - `drm_protected` (boolean) - whether entire document is DRM protected
      - `drm_protected_pages` (integer[]) - array of protected page numbers
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `regions`
      - `id` (uuid, primary key)
      - `worksheet_id` (text, foreign key) - references worksheets.id
      - `page` (integer) - page number
      - `x` (numeric) - x coordinate
      - `y` (numeric) - y coordinate  
      - `width` (numeric) - region width
      - `height` (numeric) - region height
      - `type` (text) - region type (e.g., "area")
      - `name` (text) - region name (e.g., "1_1", "2_3")
      - `description` (text[]) - array of description steps
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for public read access (since this is educational content)
*/

-- Create worksheets table
CREATE TABLE IF NOT EXISTS worksheets (
  id text PRIMARY KEY,
  document_name text NOT NULL,
  document_id uuid NOT NULL DEFAULT gen_random_uuid(),
  drm_protected boolean DEFAULT false,
  drm_protected_pages integer[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create regions table
CREATE TABLE IF NOT EXISTS regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id text NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
  page integer NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  width numeric NOT NULL,
  height numeric NOT NULL,
  type text NOT NULL DEFAULT 'area',
  name text NOT NULL,
  description text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_regions_worksheet_id ON regions(worksheet_id);
CREATE INDEX IF NOT EXISTS idx_regions_page ON regions(page);
CREATE INDEX IF NOT EXISTS idx_regions_worksheet_page ON regions(worksheet_id, page);

-- Enable Row Level Security
ALTER TABLE worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (educational content)
CREATE POLICY "Allow public read access to worksheets"
  ON worksheets
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public read access to regions"
  ON regions
  FOR SELECT
  TO public
  USING (true);

-- Create policies for authenticated users to manage content
CREATE POLICY "Allow authenticated users to manage worksheets"
  ON worksheets
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to manage regions"
  ON regions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_worksheets_updated_at
  BEFORE UPDATE ON worksheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_regions_updated_at
  BEFORE UPDATE ON regions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();