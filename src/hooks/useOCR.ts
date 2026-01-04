import { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';

export interface ExtractedData {
  fullText: string;
  firstName?: string;
  lastName?: string;
  nationalId?: string;
  dateOfBirth?: string;
  gender?: string;
  email?: string;
  phone?: string;
  address?: string;
  confidence: number;
}

interface UseOCRReturn {
  extractText: (imageFile: File) => Promise<ExtractedData>;
  isProcessing: boolean;
  progress: number;
  error: string | null;
}

// Common patterns for ID card data extraction
const patterns = {
  // Pakistani CNIC format: 12345-1234567-1
  cnic: /\b(\d{5}[-\s]?\d{7}[-\s]?\d)\b/,
  // Generic national ID (13-15 digits)
  nationalId: /\b(\d{13,15})\b/,
  // Date formats: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  date: /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\b/,
  // Email
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  // Phone number (various formats)
  phone: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/,
  // Gender keywords
  gender: /\b(male|female|m|f|مرد|عورت)\b/i,
};

function parseExtractedText(text: string): Partial<ExtractedData> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result: Partial<ExtractedData> = {};
  
  // Try to extract national ID (CNIC)
  const cnicMatch = text.match(patterns.cnic);
  if (cnicMatch) {
    result.nationalId = cnicMatch[1].replace(/\s/g, '');
  } else {
    const nationalIdMatch = text.match(patterns.nationalId);
    if (nationalIdMatch) {
      result.nationalId = nationalIdMatch[1];
    }
  }
  
  // Try to extract date of birth
  const dateMatches = text.match(new RegExp(patterns.date, 'g'));
  if (dateMatches && dateMatches.length > 0) {
    // Usually the first date on an ID is DOB
    result.dateOfBirth = normalizeDate(dateMatches[0]);
  }
  
  // Try to extract email
  const emailMatch = text.match(patterns.email);
  if (emailMatch) {
    result.email = emailMatch[0].toLowerCase();
  }
  
  // Try to extract phone
  const phoneMatch = text.match(patterns.phone);
  if (phoneMatch) {
    result.phone = phoneMatch[0];
  }
  
  // Try to extract gender
  const genderMatch = text.match(patterns.gender);
  if (genderMatch) {
    const g = genderMatch[1].toLowerCase();
    result.gender = (g === 'm' || g === 'male' || g === 'مرد') ? 'male' : 'female';
  }
  
  // Try to extract name (heuristic: look for common patterns)
  const nameResult = extractName(lines);
  if (nameResult.firstName) result.firstName = nameResult.firstName;
  if (nameResult.lastName) result.lastName = nameResult.lastName;
  
  // Try to extract address (usually multi-line, look for keywords)
  const addressResult = extractAddress(lines);
  if (addressResult) result.address = addressResult;
  
  return result;
}

function normalizeDate(dateStr: string): string {
  // Convert various formats to YYYY-MM-DD
  const parts = dateStr.split(/[-\/]/);
  if (parts.length !== 3) return dateStr;
  
  // Check if first part is year (YYYY-MM-DD)
  if (parts[0].length === 4) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  
  // Assume DD-MM-YYYY or DD/MM/YYYY
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

function extractName(lines: string[]): { firstName?: string; lastName?: string } {
  // Look for lines that might contain names
  // Common patterns: "Name: John Doe", "JOHN DOE", lines after "Name" label
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for "Name:" pattern
    const nameMatch = line.match(/name\s*[:\.]\s*(.+)/i);
    if (nameMatch) {
      const nameParts = nameMatch[1].trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return {
          firstName: capitalizeFirst(nameParts[0]),
          lastName: capitalizeFirst(nameParts.slice(1).join(' ')),
        };
      } else if (nameParts.length === 1) {
        return { firstName: capitalizeFirst(nameParts[0]) };
      }
    }
    
    // Look for "Father's Name" pattern to identify name above it
    if (/father|والد/i.test(line) && i > 0) {
      const prevLine = lines[i - 1];
      // Previous line might be the person's name
      if (prevLine && !/:/.test(prevLine) && prevLine.length > 2) {
        const nameParts = prevLine.trim().split(/\s+/);
        if (nameParts.length >= 2 && nameParts.every(p => /^[a-zA-Z]+$/.test(p))) {
          return {
            firstName: capitalizeFirst(nameParts[0]),
            lastName: capitalizeFirst(nameParts.slice(1).join(' ')),
          };
        }
      }
    }
  }
  
  // Fallback: look for lines with only alphabetic words (potential names)
  for (const line of lines) {
    const words = line.trim().split(/\s+/);
    if (words.length >= 2 && words.length <= 4 && words.every(w => /^[A-Za-z]+$/.test(w))) {
      // Check it's not a common label
      const lowerLine = line.toLowerCase();
      if (!/(name|date|birth|gender|father|mother|address|id|card|identity)/i.test(lowerLine)) {
        return {
          firstName: capitalizeFirst(words[0]),
          lastName: capitalizeFirst(words.slice(1).join(' ')),
        };
      }
    }
  }
  
  return {};
}

function extractAddress(lines: string[]): string | undefined {
  // Look for address patterns
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for "Address:" pattern
    const addressMatch = line.match(/address\s*[:\.]\s*(.+)/i);
    if (addressMatch) {
      let address = addressMatch[1].trim();
      // Collect following lines that might be part of address
      for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
        const nextLine = lines[j];
        // Stop if we hit another field label
        if (/:/.test(nextLine)) break;
        address += ', ' + nextLine;
      }
      return address;
    }
  }
  
  return undefined;
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function useOCR(): UseOCRReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const extractText = useCallback(async (imageFile: File): Promise<ExtractedData> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);

    try {
      const result = await Tesseract.recognize(imageFile, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const fullText = result.data.text;
      const confidence = result.data.confidence;
      const parsedData = parseExtractedText(fullText);

      return {
        fullText,
        confidence,
        ...parsedData,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'OCR processing failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  }, []);

  return {
    extractText,
    isProcessing,
    progress,
    error,
  };
}
