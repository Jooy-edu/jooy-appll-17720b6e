-- Clean up library to keep only Level 1 and Level 2 from books@jooy.io
-- Delete documents and folders: Arabic, Math, Science

-- First, clean up related data for documents in these folders
DELETE FROM document_regions 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE folder_id IN (
    '97a7beb1-e487-4aac-94ae-8006f1216843', -- Arabic
    '78c090af-15b8-490f-8987-19ee854494a0', -- Math
    'c4ed222a-8b68-47f8-8869-6885df958cf0'  -- Science
  )
);

DELETE FROM document_texts 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE folder_id IN (
    '97a7beb1-e487-4aac-94ae-8006f1216843', -- Arabic
    '78c090af-15b8-490f-8987-19ee854494a0', -- Math
    'c4ed222a-8b68-47f8-8869-6885df958cf0'  -- Science
  )
);

DELETE FROM text_assignments 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE folder_id IN (
    '97a7beb1-e487-4aac-94ae-8006f1216843', -- Arabic
    '78c090af-15b8-490f-8987-19ee854494a0', -- Math
    'c4ed222a-8b68-47f8-8869-6885df958cf0'  -- Science
  )
);

DELETE FROM tts_audio_files 
WHERE tts_request_id IN (
  SELECT id FROM tts_requests 
  WHERE document_id IN (
    SELECT id FROM documents 
    WHERE folder_id IN (
      '97a7beb1-e487-4aac-94ae-8006f1216843', -- Arabic
      '78c090af-15b8-490f-8987-19ee854494a0', -- Math
      'c4ed222a-8b68-47f8-8869-6885df958cf0'  -- Science
    )
  )
);

DELETE FROM tts_requests 
WHERE document_id IN (
  SELECT id FROM documents 
  WHERE folder_id IN (
    '97a7beb1-e487-4aac-94ae-8006f1216843', -- Arabic
    '78c090af-15b8-490f-8987-19ee854494a0', -- Math
    'c4ed222a-8b68-47f8-8869-6885df958cf0'  -- Science
  )
);

-- Delete documents from unwanted folders
DELETE FROM documents 
WHERE folder_id IN (
  '97a7beb1-e487-4aac-94ae-8006f1216843', -- Arabic
  '78c090af-15b8-490f-8987-19ee854494a0', -- Math
  'c4ed222a-8b68-47f8-8869-6885df958cf0'  -- Science
);

-- Finally, delete the unwanted folders
DELETE FROM folders 
WHERE id IN (
  '97a7beb1-e487-4aac-94ae-8006f1216843', -- Arabic
  '78c090af-15b8-490f-8987-19ee854494a0', -- Math
  'c4ed222a-8b68-47f8-8869-6885df958cf0'  -- Science
);