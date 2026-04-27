-- Adds `scanned_pdf_url` to maintenance_submissions so the PDF-based workflow
-- (download blank → print → fill → scan → upload) can store the completed
-- scan against a submission. Reviewers embed the PDF inline rather than
-- viewing field-by-field responses.

ALTER TABLE maintenance_submissions
    ADD COLUMN IF NOT EXISTS scanned_pdf_url TEXT;

ALTER TABLE maintenance_submissions
    ADD COLUMN IF NOT EXISTS submitter_notes TEXT;
