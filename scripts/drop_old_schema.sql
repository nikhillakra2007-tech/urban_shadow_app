-- Drop the OLD flat single-table schema (urban_grid_master with 70+ columns)
-- to make way for the normalized GRID + 18 group tables.
-- Run ONLY after confirming you no longer need the old table's data.

DROP TABLE IF EXISTS urban_scores CASCADE;
DROP TABLE IF EXISTS commercial CASCADE;
DROP TABLE IF EXISTS essential_services CASCADE;
DROP TABLE IF EXISTS public_transport CASCADE;
DROP TABLE IF EXISTS drainage CASCADE;
DROP TABLE IF EXISTS green CASCADE;
DROP TABLE IF EXISTS buildings CASCADE;
DROP TABLE IF EXISTS walkability CASCADE;
DROP TABLE IF EXISTS vehicles CASCADE;
DROP TABLE IF EXISTS traffic CASCADE;
DROP TABLE IF EXISTS roads CASCADE;
DROP TABLE IF EXISTS water CASCADE;
DROP TABLE IF EXISTS night CASCADE;
DROP TABLE IF EXISTS population CASCADE;
DROP TABLE IF EXISTS air CASCADE;
DROP TABLE IF EXISTS terrain CASCADE;
DROP TABLE IF EXISTS weather CASCADE;
DROP TABLE IF EXISTS vegetation CASCADE;
DROP TABLE IF EXISTS heat CASCADE;
DROP TABLE IF EXISTS urban_grid_master CASCADE;