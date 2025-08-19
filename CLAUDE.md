# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Facility Management System** (시설 관리 시스템) built with Next.js 14 and TypeScript. It's a Korean facility inspection and reporting system that integrates with Google Drive API and Google Sheets API for file management and data storage.

**Key Features:**
- Business facility file upload system with automatic folder organization
- Google Drive integration for file storage with categorized folders (기본사진/배출시설/방지시설)
- Google Sheets integration for business data management
- Mobile-optimized PWA with service worker support
- Real-time business list loading from Google Sheets

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

The system requires `.env.local` file with Google API credentials:

```env
# Google API Authentication
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"

# Google Drive Folder IDs
PRESURVEY_FOLDER_ID=your_folder_id
COMPLETION_FOLDER_ID=15zwT-4-8SybkURKXzKw_kARTgNAh9pb6

# Google Sheets IDs
MAIN_SPREADSHEET_ID=your_spreadsheet_id
DATA_COLLECTION_SPREADSHEET_ID=your_spreadsheet_id  # 설치 전 실사용
COMPLETION_SPREADSHEET_ID=1eEkO1LyqlhZiW-1en3ir5VzE652J5AT2Pg6Z_if1Tqo  # 설치 후 사진용
UPLOAD_SPREADSHEET_ID=your_spreadsheet_id
```

## Architecture

### Core Structure
- **Next.js App Router**: Using the new app directory structure
- **API Routes**: RESTful endpoints in `/app/api/` for Google integration
- **Google Client Library**: Centralized in `/lib/google-client.ts`
- **Type Definitions**: Shared interfaces in `/types/index.ts`

### Key Components
- **Business Selection**: Homepage with searchable business list from Google Sheets
- **File Upload System**: Multi-category file upload with Google Drive integration
- **Reporting System**: PDF generation and email notifications
- **Performance Monitoring**: Built-in performance tracking and optimization

### Google Integration
- **Sheets API**: Business data sourced from "설치 전 실사" sheet column B
- **Drive API**: Automatic folder creation with structure: `[BusinessName]/기본사진|배출시설|방지시설`
- **Authentication**: Service account based authentication with proper scopes

### Data Flow
1. Business list loaded from Google Sheets on homepage
2. User selects business → navigates to business-specific page
3. File uploads organized into categorized Google Drive folders
4. Upload records tracked in Google Sheets
5. Completion notifications sent via email

## Important Files

- `/lib/google-client.ts` - Google API authentication and client setup
- `/app/api/business-list/route.ts` - Business data retrieval from Google Sheets
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