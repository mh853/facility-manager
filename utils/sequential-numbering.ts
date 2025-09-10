// utils/sequential-numbering.ts - Sequential facility numbering utilities

import { Facility } from '@/types';

/**
 * Sequential Facility Numbering Logic
 * 
 * Requirements:
 * - Discharge facilities: Sequential numbering across ALL outlets (배1, 배2, 배3...)
 * - Prevention facilities: Sequential numbering across ALL outlets (방1, 방2, 방3...)
 * - Order: by outlet_number ASC, then facility_number ASC within each outlet
 */

export interface SequentialFacilityInfo {
  outlet: number;
  number: number; // Per-outlet facility number
  sequentialNumber: number; // Cross-outlet sequential number
  name: string;
  capacity: string;
  quantity: number;
}

/**
 * Calculate sequential numbers for facilities
 * @param facilities Array of facilities to process
 * @param facilityType Type of facility ('discharge' or 'prevention')
 * @returns Array of facilities with sequential numbers assigned
 */
export function calculateSequentialNumbers(
  facilities: Facility[], 
  facilityType: 'discharge' | 'prevention'
): Facility[] {
  // Filter facilities by type and sort by outlet, then by facility number
  const sortedFacilities = facilities
    .filter(facility => Boolean(facility)) // Remove null/undefined
    .sort((a, b) => {
      // Primary sort: outlet number ascending
      if (a.outlet !== b.outlet) {
        return a.outlet - b.outlet;
      }
      // Secondary sort: facility number ascending within same outlet
      return a.number - b.number;
    });

  // Assign sequential numbers
  return sortedFacilities.map((facility, index) => ({
    ...facility,
    sequentialNumber: index + 1 // Start from 1: 배1, 배2, 배3... or 방1, 방2, 방3...
  }));
}

/**
 * Get sequential number for a specific facility
 * @param facilities All facilities of the same type
 * @param targetFacility The facility to find the sequential number for
 * @param facilityType Type of facility
 * @returns Sequential number (1-based)
 */
export function getSequentialNumberForFacility(
  facilities: Facility[],
  targetFacility: Facility,
  facilityType: 'discharge' | 'prevention'
): number {
  const facilitiesWithSequential = calculateSequentialNumbers(facilities, facilityType);
  
  const found = facilitiesWithSequential.find(facility => 
    facility.outlet === targetFacility.outlet && 
    facility.number === targetFacility.number &&
    facility.name === targetFacility.name
  );
  
  return found?.sequentialNumber || 1;
}

/**
 * Generate sequential facility label for display
 * @param facilityType Type of facility
 * @param sequentialNumber Sequential number (1-based)
 * @returns Display label (e.g., "배1", "방3")
 */
export function generateSequentialLabel(
  facilityType: 'discharge' | 'prevention',
  sequentialNumber: number
): string {
  const prefix = facilityType === 'discharge' ? '배' : '방';
  return `${prefix}${sequentialNumber}`;
}

/**
 * Update filename generation to use sequential numbers
 * @param facility Facility information
 * @param facilityType Type of facility
 * @param allFacilities All facilities of the same type for sequential calculation
 * @param photoIndex Photo sequence number
 * @param originalFileName Original file name
 * @returns Generated filename with sequential numbering
 */
export function generateSequentialFileName(
  facility: Facility,
  facilityType: 'discharge' | 'prevention',
  allFacilities: Facility[],
  photoIndex: number,
  originalFileName: string = 'photo.jpg'
): string {
  // Calculate sequential number
  const sequentialNumber = facility.sequentialNumber || 
    getSequentialNumberForFacility(allFacilities, facility, facilityType);
  
  // Generate filename components
  const facilityLabel = generateSequentialLabel(facilityType, sequentialNumber);
  const facilityInfo = sanitizeFacilityInfo(facility.name, facility.capacity);
  const photoOrder = `${photoIndex}번째`;
  const timestamp = generateTimestamp();
  const extension = getFileExtension(originalFileName);
  
  // Handle quantity instances (multiple identical facilities)
  const quantitySuffix = facility.quantity > 1 ? '-1' : ''; // Default to first instance
  
  return `${facilityLabel}${quantitySuffix}_${facilityInfo}_${photoOrder}_${timestamp}.${extension}`;
}

/**
 * Batch update sequential numbers for all facilities
 * @param discharge Array of discharge facilities
 * @param prevention Array of prevention facilities
 * @returns Updated facilities with sequential numbers
 */
export function updateAllSequentialNumbers(
  discharge: Facility[],
  prevention: Facility[]
): { discharge: Facility[], prevention: Facility[] } {
  return {
    discharge: calculateSequentialNumbers(discharge, 'discharge'),
    prevention: calculateSequentialNumbers(prevention, 'prevention')
  };
}

// Helper functions
function sanitizeFacilityInfo(name: string, capacity: string): string {
  const cleanName = name
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[()]/g, '') // Remove parentheses
    .trim();

  const cleanCapacity = capacity
    .replace(/\s+/g, '') // Remove spaces only
    .trim();

  return `${cleanName}${cleanCapacity}`;
}

function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'jpg' || ext === 'jpeg' || ext === 'png' ? 'webp' : (ext || 'webp');
}

/**
 * Example usage and validation
 */
export const SequentialNumberingExample = {
  // Example: Outlet 1 has 3 facilities, Outlet 2 has 2 facilities, Outlet 3 has 4 facilities
  sampleDischarge: [
    { outlet: 1, number: 1, name: '시설A', capacity: '100㎥/min', quantity: 1 },
    { outlet: 1, number: 2, name: '시설B', capacity: '200㎥/min', quantity: 1 },
    { outlet: 1, number: 3, name: '시설C', capacity: '150㎥/min', quantity: 1 },
    { outlet: 2, number: 1, name: '시설D', capacity: '300㎥/min', quantity: 1 },
    { outlet: 2, number: 2, name: '시설E', capacity: '250㎥/min', quantity: 1 },
    { outlet: 3, number: 1, name: '시설F', capacity: '180㎥/min', quantity: 1 },
    { outlet: 3, number: 2, name: '시설G', capacity: '220㎥/min', quantity: 1 },
    { outlet: 3, number: 3, name: '시설H', capacity: '160㎥/min', quantity: 1 },
    { outlet: 3, number: 4, name: '시설I', capacity: '190㎥/min', quantity: 1 }
  ] as Facility[],
  
  // Expected sequential numbers: 배1, 배2, 배3, 배4, 배5, 배6, 배7, 배8, 배9
  expectedSequence: [1, 2, 3, 4, 5, 6, 7, 8, 9]
};