-- Populate display_name for AHJs
-- Pattern: Strip common prefixes to create short dropdown labels
-- Only sets display_name where the name would actually be shorter

-- "City of X" → "X"
UPDATE ahjs SET display_name = TRIM(SUBSTRING(name FROM 9))
WHERE name LIKE 'City of %' AND display_name IS NULL;

-- "Town of X" → "X"
UPDATE ahjs SET display_name = TRIM(SUBSTRING(name FROM 9))
WHERE name LIKE 'Town of %' AND display_name IS NULL;

-- "Village of X" → "X"
UPDATE ahjs SET display_name = TRIM(SUBSTRING(name FROM 12))
WHERE name LIKE 'Village of %' AND display_name IS NULL;

-- "County of X" → "X County"
UPDATE ahjs SET display_name = TRIM(SUBSTRING(name FROM 11)) || ' County'
WHERE name LIKE 'County of %' AND display_name IS NULL;

-- Names ending in " County" that are very long — keep as-is (already descriptive)
-- Names that are already short (< 20 chars) — no display_name needed (null = use name)

-- Populate display_name for Utilities
-- Common patterns: strip LLC, Inc, Corp, Co., and trailing state abbreviations

-- Strip common suffixes
UPDATE utilities SET display_name = TRIM(TRAILING ' ' FROM
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(name, ',?\s*(LLC|Inc\.?|Corp\.?|Co\.?|Company|Corporation|L\.?P\.?|L\.?L\.?C\.?)$', '', 'i'),
        '\s+d/b/a\s+.*$', '', 'i'),
      '\s*-\s*[A-Z]{2}$', ''),
    '\s+Electric(ity)?\s*(Service|Delivery|Cooperative|Coop)?$', '', 'i'),
  '\s+Energy\s*(Services?|Delivery)?$', '', 'i')
)
WHERE display_name IS NULL
AND LENGTH(name) > 20;

-- Don't set display_name if the result would be the same as name
UPDATE utilities SET display_name = NULL
WHERE display_name = name;

-- Don't set display_name if result is empty
UPDATE utilities SET display_name = NULL
WHERE display_name = '' OR display_name IS NOT NULL AND LENGTH(TRIM(display_name)) = 0;
