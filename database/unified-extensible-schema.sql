-- 🏗️ Unified Extensible Schema for Facility Management System
-- Backward-compatible design supporting both simple and complex hierarchies
-- Created: 2025-09-01

-- =====================================================
-- PART 1: CORE BUSINESS ENTITIES (Normalized Structure)
-- =====================================================

-- 1. Enhanced Business Information Table
CREATE TABLE IF NOT EXISTS business_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Core Business Identity
    business_name VARCHAR(255) NOT NULL UNIQUE,
    business_registration_number VARCHAR(20),
    local_government VARCHAR(100),
    address TEXT,
    
    -- Contact Information
    manager_name VARCHAR(100),
    manager_position VARCHAR(50),
    manager_contact VARCHAR(20),
    business_contact VARCHAR(20),
    fax_number VARCHAR(20),
    email VARCHAR(255),
    representative_name VARCHAR(100),
    
    -- Equipment & Infrastructure (Quantities, not booleans for scalability)
    manufacturer VARCHAR(20) CHECK (manufacturer IN ('ecosense', 'cleanearth', 'gaia_cns', 'evs')) DEFAULT 'ecosense',
    vpn VARCHAR(10) CHECK (vpn IN ('wired', 'wireless')) DEFAULT 'wired',
    greenlink_id VARCHAR(50),
    greenlink_pw VARCHAR(100),
    business_management_code INTEGER,
    
    -- Measurement Devices (Quantities for scalability)
    ph_sensor INTEGER DEFAULT 0,
    differential_pressure_meter INTEGER DEFAULT 0,
    temperature_meter INTEGER DEFAULT 0,
    discharge_current_meter INTEGER DEFAULT 0,
    fan_current_meter INTEGER DEFAULT 0,
    pump_current_meter INTEGER DEFAULT 0,
    gateway INTEGER DEFAULT 0,
    vpn_wired INTEGER DEFAULT 0,
    vpn_wireless INTEGER DEFAULT 0,
    explosion_proof_differential_pressure_meter_domestic INTEGER DEFAULT 0,
    explosion_proof_temperature_meter_domestic INTEGER DEFAULT 0,
    expansion_device INTEGER DEFAULT 0,
    relay_8ch INTEGER DEFAULT 0,
    relay_16ch INTEGER DEFAULT 0,
    main_board_replacement INTEGER DEFAULT 0,
    multiple_stack INTEGER DEFAULT 0,
    
    -- Project Management
    installation_phase VARCHAR(20) DEFAULT 'presurvey' CHECK (installation_phase IN ('presurvey', 'installation', 'completed')),
    surveyor_name VARCHAR(100),
    surveyor_contact VARCHAR(50),
    surveyor_company VARCHAR(100),
    survey_date DATE,
    installation_date DATE,
    completion_date DATE,
    special_notes TEXT,
    sales_office VARCHAR(100),
    
    -- Extensible JSON field for future requirements
    additional_info JSONB DEFAULT '{}',
    
    -- Status Management
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false
);

-- 2. Air Permit Information (Enhanced)
CREATE TABLE IF NOT EXISTS air_permit_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Permit Details
    permit_number VARCHAR(50),
    business_type VARCHAR(100),
    annual_emission_amount DECIMAL(10,2),
    first_report_date DATE,
    operation_start_date DATE,
    permit_expiry_date DATE,
    
    -- Pollutant Information (Extensible JSON)
    pollutants JSONB DEFAULT '[]', -- [{"type": "PM10", "amount": 1.5, "unit": "kg/year"}]
    emission_limits JSONB DEFAULT '{}', -- {"PM10": {"limit": 10, "unit": "mg/Nm³"}}
    
    -- Extensible field
    additional_info JSONB DEFAULT '{}',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_deleted BOOLEAN DEFAULT false
);

-- 3. Discharge Outlets (Normalized Hierarchy)
CREATE TABLE IF NOT EXISTS discharge_outlets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    air_permit_id UUID NOT NULL REFERENCES air_permit_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    outlet_number INTEGER NOT NULL,
    outlet_name VARCHAR(100),
    
    -- Physical Properties
    stack_height DECIMAL(5,2), -- 굴뚝 높이 (m)
    stack_diameter DECIMAL(5,3), -- 굴뚝 직경 (m)
    flow_rate DECIMAL(10,2), -- 유량 (Nm³/min)
    
    -- Extensible field
    additional_info JSONB DEFAULT '{}',
    
    UNIQUE(air_permit_id, outlet_number)
);

-- =====================================================
-- PART 2: FACILITY ENTITIES (Dual Structure Support)
-- =====================================================

-- 4. Discharge Facilities (Normalized - preferred for new development)
CREATE TABLE IF NOT EXISTS discharge_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID REFERENCES discharge_outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Facility Information
    facility_name VARCHAR(200) NOT NULL,
    facility_code VARCHAR(50), -- Standardized facility codes
    capacity VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    
    -- Operating Conditions (Extensible)
    operating_conditions JSONB DEFAULT '{}', -- {"temperature": 150, "pressure": 1.2}
    measurement_points JSONB DEFAULT '[]', -- [{"point": "inlet", "parameters": ["temp", "pressure"]}]
    
    -- Associated Device IDs for scalability
    device_ids UUID[] DEFAULT '{}',
    
    -- Legacy Support: Direct business reference (for backward compatibility)
    business_name TEXT, -- Will be populated via trigger from outlet_id
    outlet_number INTEGER, -- Will be populated via trigger from outlet_id
    facility_number INTEGER, -- Auto-increment per outlet
    
    -- Extensible field
    additional_info JSONB DEFAULT '{}'
);

-- 5. Prevention Facilities (Normalized - preferred for new development)
CREATE TABLE IF NOT EXISTS prevention_facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outlet_id UUID REFERENCES discharge_outlets(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Facility Information
    facility_name VARCHAR(200) NOT NULL,
    facility_code VARCHAR(50),
    capacity VARCHAR(50),
    quantity INTEGER DEFAULT 1,
    
    -- Prevention-specific attributes
    efficiency_rating DECIMAL(5,2), -- Removal efficiency (%)
    media_type VARCHAR(50), -- Filter media, activated carbon, etc.
    maintenance_interval INTEGER, -- Days between maintenance
    
    -- Operating Conditions
    operating_conditions JSONB DEFAULT '{}',
    measurement_points JSONB DEFAULT '[]',
    device_ids UUID[] DEFAULT '{}',
    
    -- Legacy Support
    business_name TEXT,
    outlet_number INTEGER,
    facility_number INTEGER,
    
    -- Extensible field
    additional_info JSONB DEFAULT '{}'
);

-- =====================================================
-- PART 3: MEASUREMENT & DEVICE MANAGEMENT
-- =====================================================

-- 6. Measurement Devices (Enhanced)
CREATE TABLE IF NOT EXISTS measurement_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Device Identity
    device_type VARCHAR(50) NOT NULL, -- 'ph_meter', 'differential_pressure_meter', 'temperature_meter', 'ct_meter', 'gateway'
    device_name VARCHAR(100) NOT NULL,
    model_number VARCHAR(100),
    serial_number VARCHAR(100),
    manufacturer VARCHAR(100),
    
    -- Installation & Location
    installation_location TEXT,
    facility_association JSONB DEFAULT '{}', -- {"discharge_facility_ids": [], "prevention_facility_ids": []}
    
    -- Technical Specifications
    measurement_range VARCHAR(50),
    accuracy VARCHAR(20),
    resolution VARCHAR(20),
    
    -- Calibration Management
    calibration_date DATE,
    next_calibration_date DATE,
    calibration_certificate VARCHAR(100),
    
    -- CT-specific Information
    ct_ratio VARCHAR(20),
    primary_current VARCHAR(20),
    secondary_current VARCHAR(20),
    
    -- Gateway/Network Information
    ip_address INET,
    mac_address VARCHAR(17),
    firmware_version VARCHAR(20),
    communication_protocol VARCHAR(30),
    network_config JSONB DEFAULT '{}',
    
    -- Status & Maintenance
    device_status VARCHAR(20) DEFAULT 'normal' CHECK (device_status IN ('normal', 'maintenance', 'error', 'inactive')),
    is_active BOOLEAN DEFAULT true,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_history JSONB DEFAULT '[]',
    
    -- Current Measurement
    current_value DECIMAL(10,4),
    unit VARCHAR(10),
    measurement_timestamp TIMESTAMP WITH TIME ZONE,
    data_quality VARCHAR(20) DEFAULT 'normal',
    
    -- Extensible Settings
    additional_settings JSONB DEFAULT '{}',
    
    UNIQUE(business_id, device_type, serial_number)
);

-- =====================================================
-- PART 4: PROJECT & FILE MANAGEMENT
-- =====================================================

-- 7. Project Phases (Enhanced Workflow Management)
CREATE TABLE IF NOT EXISTS project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Phase Information
    phase_type VARCHAR(20) NOT NULL CHECK (phase_type IN ('presurvey', 'installation', 'completion', 'maintenance')),
    phase_name VARCHAR(100) NOT NULL,
    phase_order INTEGER DEFAULT 1,
    
    -- Scheduling
    start_date DATE,
    end_date DATE,
    expected_completion_date DATE,
    actual_completion_date DATE,
    
    -- Progress Tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100),
    
    -- Team Management
    assigned_to VARCHAR(100),
    supervisor VARCHAR(100),
    team_members JSONB DEFAULT '[]',
    
    -- Quality Control
    checklist_items JSONB DEFAULT '[]',
    completion_criteria JSONB DEFAULT '{}',
    quality_checkpoints JSONB DEFAULT '[]',
    
    -- Approval Workflow
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'revision_required')),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Documentation
    required_documents JSONB DEFAULT '[]',
    submitted_documents JSONB DEFAULT '[]',
    completion_notes TEXT,
    
    -- Extensible field
    phase_metadata JSONB DEFAULT '{}',
    
    UNIQUE(business_id, phase_type)
);

-- 8. Enhanced File Management (Extending existing uploaded_files)
-- Check if uploaded_files exists and extend it
DO $$
BEGIN
    -- Add columns if they don't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'uploaded_files') THEN
        -- Add new columns for enhanced file management
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS project_phase VARCHAR(20) DEFAULT 'presurvey' CHECK (project_phase IN ('presurvey', 'installation', 'completion', 'maintenance'));
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS document_category VARCHAR(50); -- 'survey_photo', 'installation_photo', 'completion_photo', 'certificate', 'report'
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS device_id UUID REFERENCES measurement_devices(id);
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS outlet_id UUID REFERENCES discharge_outlets(id);
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS discharge_facility_id UUID REFERENCES discharge_facilities(id);
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS prevention_facility_id UUID REFERENCES prevention_facilities(id);
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS file_metadata JSONB DEFAULT '{}';
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS processing_status VARCHAR(20) DEFAULT 'pending';
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS quality_score DECIMAL(3,2); -- 0.00-1.00
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS tags TEXT[];
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS geolocation POINT;
        ALTER TABLE uploaded_files ADD COLUMN IF NOT EXISTS capture_timestamp TIMESTAMP WITH TIME ZONE;
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE uploaded_files (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            business_id UUID REFERENCES business_info(id) ON DELETE CASCADE,
            facility_id UUID, -- Can reference either discharge or prevention facilities
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            synced_at TIMESTAMP WITH TIME ZONE,
            
            -- File Properties
            filename VARCHAR(255) NOT NULL,
            original_filename VARCHAR(255) NOT NULL,
            file_hash VARCHAR(64),
            file_path TEXT NOT NULL,
            google_file_id VARCHAR(100),
            file_size BIGINT NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            
            -- Upload Status
            upload_status VARCHAR(20) DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'syncing', 'synced', 'failed')),
            thumbnail_path TEXT,
            
            -- Enhanced Classification
            project_phase VARCHAR(20) DEFAULT 'presurvey' CHECK (project_phase IN ('presurvey', 'installation', 'completion', 'maintenance')),
            document_category VARCHAR(50),
            
            -- Relationships (Flexible - can associate with multiple entities)
            device_id UUID REFERENCES measurement_devices(id),
            outlet_id UUID REFERENCES discharge_outlets(id),
            discharge_facility_id UUID REFERENCES discharge_facilities(id),
            prevention_facility_id UUID REFERENCES prevention_facilities(id),
            
            -- Quality & Processing
            processing_status VARCHAR(20) DEFAULT 'pending',
            quality_score DECIMAL(3,2),
            tags TEXT[],
            
            -- Spatial Data
            geolocation POINT, -- GPS coordinates
            capture_timestamp TIMESTAMP WITH TIME ZONE,
            
            -- Legacy support
            facility_info TEXT, -- Keep for backward compatibility
            
            -- Extensible metadata
            file_metadata JSONB DEFAULT '{}'
        );
    END IF;
END $$;

-- =====================================================
-- PART 5: DATA AUDIT & HISTORY
-- =====================================================

-- 9. Enhanced Data History Table
CREATE TABLE IF NOT EXISTS data_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Change Tracking
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    
    -- Data Snapshots
    old_data JSONB,
    new_data JSONB,
    changed_fields TEXT[], -- Array of changed field names
    
    -- User & Session Tracking
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    user_agent TEXT,
    ip_address INET,
    
    -- Change Metadata
    change_reason TEXT,
    change_type VARCHAR(30), -- 'manual', 'bulk_import', 'api', 'migration'
    source_system VARCHAR(30), -- 'web_app', 'mobile_app', 'api', 'migration'
    
    -- Data Validation
    validation_status VARCHAR(20) DEFAULT 'pending',
    validation_errors JSONB DEFAULT '[]',
    
    -- Performance tracking
    processing_time_ms INTEGER
);

-- =====================================================
-- PART 6: MEASUREMENT DATA & ANALYTICS
-- =====================================================

-- 10. Measurement History (Enhanced)
CREATE TABLE IF NOT EXISTS measurement_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES measurement_devices(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    measured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Measurement Data
    measured_value DECIMAL(10,4) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    measurement_type VARCHAR(30),
    
    -- Data Quality
    data_quality VARCHAR(20) DEFAULT 'normal' CHECK (data_quality IN ('normal', 'warning', 'error', 'calibration', 'maintenance')),
    confidence_level DECIMAL(3,2) DEFAULT 1.00,
    quality_flags TEXT[], -- ['outlier', 'drift', 'noise']
    
    -- Context Information
    measurement_method VARCHAR(50),
    environmental_conditions JSONB DEFAULT '{}',
    calibration_status BOOLEAN DEFAULT true,
    operator_notes TEXT,
    
    -- Derived/Calculated Fields
    normalized_value DECIMAL(10,4), -- Normalized to standard conditions
    trend_direction VARCHAR(10), -- 'increasing', 'decreasing', 'stable'
    alarm_status VARCHAR(20), -- 'normal', 'warning', 'alarm', 'critical'
    
    -- Partitioning helper
    date_bucket DATE GENERATED ALWAYS AS (DATE(measured_at)) STORED,
    hour_bucket INTEGER GENERATED ALWAYS AS (EXTRACT(HOUR FROM measured_at)) STORED
);

-- =====================================================
-- PART 7: REPORTING & ANALYTICS
-- =====================================================

-- 11. Report Generation History
CREATE TABLE IF NOT EXISTS report_generation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Report Metadata
    report_type VARCHAR(30) NOT NULL,
    report_format VARCHAR(10) DEFAULT 'pdf' CHECK (report_format IN ('pdf', 'excel', 'word', 'json')),
    report_title VARCHAR(200),
    template_version VARCHAR(20),
    
    -- Generation Context
    generated_by VARCHAR(100),
    generation_trigger VARCHAR(30), -- 'manual', 'scheduled', 'event_driven'
    report_period_start DATE,
    report_period_end DATE,
    
    -- File Information
    file_path TEXT,
    file_size BIGINT,
    file_hash VARCHAR(64),
    download_count INTEGER DEFAULT 0,
    
    -- Status Tracking
    generation_status VARCHAR(20) DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
    error_message TEXT,
    generation_time_ms INTEGER,
    
    -- Content Summary
    summary JSONB DEFAULT '{}',
    included_data JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}' -- Performance metrics, counts, etc.
);

-- =====================================================
-- PART 8: SYSTEM CONFIGURATION & METADATA
-- =====================================================

-- 12. System Configuration
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    config_key VARCHAR(100) NOT NULL UNIQUE,
    config_value JSONB NOT NULL,
    config_type VARCHAR(30) DEFAULT 'setting', -- 'setting', 'feature_flag', 'integration'
    description TEXT,
    
    -- Validation
    validation_schema JSONB, -- JSON Schema for config_value validation
    is_sensitive BOOLEAN DEFAULT false, -- For secrets/credentials
    
    -- Environment & Deployment
    environment VARCHAR(20) DEFAULT 'development', -- 'development', 'staging', 'production'
    version VARCHAR(20),
    
    is_active BOOLEAN DEFAULT true
);

-- 13. Integration Status (Google Drive, Sheets, etc.)
CREATE TABLE IF NOT EXISTS integration_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES business_info(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Integration Type
    integration_type VARCHAR(30) NOT NULL, -- 'google_drive', 'google_sheets', 'email', 'sms'
    integration_name VARCHAR(100),
    
    -- Connection Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error', 'pending')),
    last_sync_at TIMESTAMP WITH TIME ZONE,
    next_sync_at TIMESTAMP WITH TIME ZONE,
    sync_frequency_minutes INTEGER DEFAULT 60,
    
    -- Configuration
    config JSONB DEFAULT '{}', -- API keys, endpoints, settings
    credentials_hash VARCHAR(64), -- Hashed credentials for validation
    
    -- Performance Metrics
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_error_message TEXT,
    avg_response_time_ms INTEGER,
    
    -- Quota & Limits
    daily_quota INTEGER,
    daily_usage INTEGER DEFAULT 0,
    monthly_quota INTEGER,
    monthly_usage INTEGER DEFAULT 0,
    
    UNIQUE(business_id, integration_type)
);

-- =====================================================
-- PART 9: BACKWARD COMPATIBILITY SUPPORT
-- =====================================================

-- 14. Legacy Support Triggers (Automatic Population)
CREATE OR REPLACE FUNCTION sync_legacy_facility_fields()
RETURNS TRIGGER AS $$
DECLARE
    outlet_info RECORD;
    business_name_val TEXT;
    outlet_number_val INTEGER;
    max_facility_number INTEGER;
BEGIN
    -- Get outlet and business information
    SELECT 
        do.outlet_number,
        bi.business_name
    INTO outlet_info
    FROM discharge_outlets do
    JOIN air_permit_info api ON do.air_permit_id = api.id
    JOIN business_info bi ON api.business_id = bi.id
    WHERE do.id = NEW.outlet_id;
    
    -- Set legacy fields
    NEW.business_name := outlet_info.business_name;
    NEW.outlet_number := outlet_info.outlet_number;
    
    -- Auto-increment facility_number if not provided
    IF NEW.facility_number IS NULL THEN
        SELECT COALESCE(MAX(facility_number), 0) + 1
        INTO max_facility_number
        FROM discharge_facilities
        WHERE outlet_id = NEW.outlet_id;
        
        NEW.facility_number := max_facility_number;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to both facility tables
CREATE TRIGGER sync_discharge_facility_legacy
    BEFORE INSERT OR UPDATE ON discharge_facilities
    FOR EACH ROW
    WHEN (NEW.outlet_id IS NOT NULL)
    EXECUTE FUNCTION sync_legacy_facility_fields();

CREATE TRIGGER sync_prevention_facility_legacy
    BEFORE INSERT OR UPDATE ON prevention_facilities
    FOR EACH ROW
    WHEN (NEW.outlet_id IS NOT NULL)
    EXECUTE FUNCTION sync_legacy_facility_fields();

-- =====================================================
-- PART 10: INDEXES FOR PERFORMANCE
-- =====================================================

-- Core Business Indexes
CREATE INDEX IF NOT EXISTS idx_business_info_name ON business_info(business_name);
CREATE INDEX IF NOT EXISTS idx_business_info_active ON business_info(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_business_info_phase ON business_info(installation_phase);
CREATE INDEX IF NOT EXISTS idx_business_info_manager ON business_info(manager_name, manager_contact);

-- Permit & Outlet Indexes
CREATE INDEX IF NOT EXISTS idx_air_permit_business ON air_permit_info(business_id);
CREATE INDEX IF NOT EXISTS idx_air_permit_active ON air_permit_info(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discharge_outlets_permit ON discharge_outlets(air_permit_id);
CREATE INDEX IF NOT EXISTS idx_discharge_outlets_number ON discharge_outlets(air_permit_id, outlet_number);

-- Facility Indexes (Supporting both normalized and legacy queries)
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_outlet ON discharge_facilities(outlet_id);
CREATE INDEX IF NOT EXISTS idx_discharge_facilities_legacy ON discharge_facilities(business_name, outlet_number, facility_number);
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_outlet ON prevention_facilities(outlet_id);
CREATE INDEX IF NOT EXISTS idx_prevention_facilities_legacy ON prevention_facilities(business_name, outlet_number, facility_number);

-- Device & Measurement Indexes
CREATE INDEX IF NOT EXISTS idx_measurement_devices_business ON measurement_devices(business_id);
CREATE INDEX IF NOT EXISTS idx_measurement_devices_type_status ON measurement_devices(business_id, device_type, device_status);
CREATE INDEX IF NOT EXISTS idx_measurement_devices_maintenance ON measurement_devices(next_maintenance_date) WHERE device_status = 'normal';

-- Measurement History Indexes (Optimized for time-series queries)
CREATE INDEX IF NOT EXISTS idx_measurement_history_device_time ON measurement_history(device_id, measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_measurement_history_business_date ON measurement_history(business_id, date_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_measurement_history_quality ON measurement_history(data_quality) WHERE data_quality != 'normal';
CREATE INDEX IF NOT EXISTS idx_measurement_history_hourly ON measurement_history(business_id, date_bucket, hour_bucket);

-- File Management Indexes
CREATE INDEX IF NOT EXISTS idx_uploaded_files_business_phase ON uploaded_files(business_id, project_phase);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_category ON uploaded_files(document_category);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_device ON uploaded_files(device_id) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON uploaded_files(upload_status, project_phase);

-- Project & Reporting Indexes
CREATE INDEX IF NOT EXISTS idx_project_phases_business_type ON project_phases(business_id, phase_type);
CREATE INDEX IF NOT EXISTS idx_project_phases_status ON project_phases(status, expected_completion_date);
CREATE INDEX IF NOT EXISTS idx_report_generation_business_type ON report_generation_history(business_id, report_type);

-- Data History Indexes
CREATE INDEX IF NOT EXISTS idx_data_history_table_record ON data_history(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_data_history_created ON data_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_history_user ON data_history(user_id, created_at DESC);

-- Integration Status Indexes
CREATE INDEX IF NOT EXISTS idx_integration_status_type ON integration_status(integration_type, status);
CREATE INDEX IF NOT EXISTS idx_integration_status_sync ON integration_status(next_sync_at) WHERE status = 'active';

-- =====================================================
-- PART 11: AUTOMATED TRIGGERS & FUNCTIONS
-- =====================================================

-- Updated_at triggers for all tables
CREATE TRIGGER update_air_permit_info_updated_at BEFORE UPDATE ON air_permit_info FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discharge_outlets_updated_at BEFORE UPDATE ON discharge_outlets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_discharge_facilities_updated_at BEFORE UPDATE ON discharge_facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prevention_facilities_updated_at BEFORE UPDATE ON prevention_facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_measurement_devices_updated_at BEFORE UPDATE ON measurement_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_phases_updated_at BEFORE UPDATE ON project_phases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_integration_status_updated_at BEFORE UPDATE ON integration_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Data history triggers
CREATE TRIGGER business_info_history AFTER INSERT OR UPDATE OR DELETE ON business_info FOR EACH ROW EXECUTE FUNCTION save_data_history();
CREATE TRIGGER air_permit_info_history AFTER INSERT OR UPDATE OR DELETE ON air_permit_info FOR EACH ROW EXECUTE FUNCTION save_data_history();
CREATE TRIGGER discharge_outlets_history AFTER INSERT OR UPDATE OR DELETE ON discharge_outlets FOR EACH ROW EXECUTE FUNCTION save_data_history();
CREATE TRIGGER discharge_facilities_history AFTER INSERT OR UPDATE OR DELETE ON discharge_facilities FOR EACH ROW EXECUTE FUNCTION save_data_history();
CREATE TRIGGER prevention_facilities_history AFTER INSERT OR UPDATE OR DELETE ON prevention_facilities FOR EACH ROW EXECUTE FUNCTION save_data_history();
CREATE TRIGGER measurement_devices_history AFTER INSERT OR UPDATE OR DELETE ON measurement_devices FOR EACH ROW EXECUTE FUNCTION save_data_history();

-- =====================================================
-- PART 12: ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE business_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE air_permit_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE discharge_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE prevention_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_generation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_history ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow all for now - enhance with authentication later)
CREATE POLICY "Enable all operations" ON business_info FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON air_permit_info FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON discharge_outlets FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON discharge_facilities FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON prevention_facilities FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON measurement_devices FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON project_phases FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON measurement_history FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON report_generation_history FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON system_config FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON integration_status FOR ALL USING (true);
CREATE POLICY "Enable all operations" ON data_history FOR ALL USING (true);

COMMENT ON DATABASE postgres IS 'Unified Extensible Facility Management System - Supporting both legacy and modern schemas';