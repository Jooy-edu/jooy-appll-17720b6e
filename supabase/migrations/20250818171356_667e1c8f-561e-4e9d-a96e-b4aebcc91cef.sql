-- Enable realtime for folders table (documents already enabled)
ALTER TABLE public.folders REPLICA IDENTITY FULL;

-- Add folders table to realtime publication (documents already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.folders;