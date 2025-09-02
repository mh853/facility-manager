# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Facility Management System** (시설 관리 시스템) built with Next.js 14 and TypeScript. It's a Korean facility inspection and reporting system that uses Supabase for data storage and file management.

**Key Features:**
- Business facility file upload system with automatic categorization
- Supabase storage integration for file management with categorized folders (기본사진/배출시설/방지시설)
- Supabase database integration for business and facility data management
- Mobile-optimized PWA with service worker support
- Real-time business list loading from Supabase

## Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Mobile development (network accessible)
npm run dev-mobile

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Environment Setup

The system requires `.env.local` file with Supabase credentials:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_public_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Architecture

### Core Structure
- **Next.js App Router**: Using the new app directory structure
- **API Routes**: RESTful endpoints in `/app/api/` for Supabase integration
- **Supabase Client**: Database and storage integration
- **Type Definitions**: Shared interfaces in `/types/index.ts`

### Key Components
- **Business Selection**: Homepage with searchable business list from Supabase
- **File Upload System**: Multi-category file upload with Supabase storage integration
- **Reporting System**: PDF generation and email notifications
- **Performance Monitoring**: Built-in performance tracking and optimization

### Supabase Integration
- **Database**: Business and facility data stored in Supabase tables
- **Storage**: File uploads organized with structure: `business/[systemType]/[category]/[facility]/`
- **Authentication**: Row Level Security with service role authentication

### Data Flow
1. Business list loaded from Supabase database on homepage
2. User selects business → navigates to business-specific page
3. File uploads organized into categorized Supabase storage buckets
4. Upload records tracked in Supabase database
5. Completion notifications sent via email

## Important Files

- `/lib/supabase.ts` - Supabase client setup and authentication
- `/app/api/business-list/route.ts` - Business data retrieval from Supabase
- `/app/api/uploaded-files-supabase/route.ts` - File management with Supabase storage
- `/types/index.ts` - TypeScript interfaces for Facility, BusinessInfo, FileInfo
- `/app/layout.tsx` - Global layout with PWA setup and performance monitoring
- `/utils/` - Utility functions for email, validation, and performance tracking

## System URLs

- Main app: `http://localhost:3000`
- Admin panel: `http://localhost:3000/admin`
- API testing: `http://localhost:3000/test`
- Business pages: `http://localhost:3000/business/[businessName]`

## Technical Notes

- Uses Korean language throughout the interface
- PWA-enabled with service worker registration
- Performance monitoring built into layout
- Mobile-first responsive design with Tailwind CSS
- Error handling with fallback data display
- Real-time data loading with loading states
- Supabase storage for file management
- PostgreSQL database for structured data