-- Add facility_summary column to business_info table
-- This column will store aggregated facility data for performance optimization

ALTER TABLE business_info 
ADD COLUMN IF NOT EXISTS facility_summary JSONB DEFAULT '{}';

-- Create index for facility_summary queries
CREATE INDEX IF NOT EXISTS idx_business_info_facility_summary 
ON business_info USING GIN (facility_summary);

-- Comment explaining the structure
COMMENT ON COLUMN business_info.facility_summary IS 
'Aggregated facility data structure: {
  "outlets": [
    {
      "outlet": 1, 
      "discharge_count": 5, 
      "prevention_count": 3,
      "discharge_facilities": ["보일러", "건조기"],
      "prevention_facilities": ["집진기", "흡착탑"]
    }
  ],
  "totals": {
    "total_outlets": 2,
    "total_discharge": 15,
    "total_prevention": 8
  },
  "last_updated": "2025-01-28T10:00:00Z"
}';