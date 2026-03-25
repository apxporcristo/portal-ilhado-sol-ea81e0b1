
-- Create storage bucket for network assets
INSERT INTO storage.buckets (id, name, public) VALUES ('network-assets', 'network-assets', true);

-- Allow anyone to read
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id = 'network-assets');

-- Allow anyone to upload (no auth in this app)
CREATE POLICY "Public insert access" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'network-assets');

-- Allow anyone to update
CREATE POLICY "Public update access" ON storage.objects FOR UPDATE USING (bucket_id = 'network-assets');

-- Allow anyone to delete
CREATE POLICY "Public delete access" ON storage.objects FOR DELETE USING (bucket_id = 'network-assets');
