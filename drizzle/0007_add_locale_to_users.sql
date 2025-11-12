-- Add locale column to users table for language preferences
ALTER TABLE users ADD COLUMN locale VARCHAR(10) DEFAULT 'en';
