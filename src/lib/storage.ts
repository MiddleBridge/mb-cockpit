import { supabase } from './supabase'

export interface UploadResult {
  url: string
  path: string
  error?: string
}

// Storage bucket name - can be overridden via env variable
const STORAGE_BUCKET = process.env.NEXT_PUBLIC_STORAGE_BUCKET || 'mb-cockpit'

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  file: File,
  folder: string = 'documents'
): Promise<UploadResult> {
  try {
    // Try to list buckets for debugging, but don't fail if it doesn't work
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.warn('Could not list buckets (this is OK, will try upload anyway):', listError.message)
    } else {
      // Debug: log all available buckets
      console.log('Available buckets:', buckets?.map(b => ({ name: b.name, public: b.public })) || 'none')
      console.log('Looking for bucket:', STORAGE_BUCKET)

      const bucketExists = buckets?.some(b => b.name === STORAGE_BUCKET)
      if (!bucketExists) {
        const availableNames = buckets?.map(b => b.name).join(', ') || 'none'
        console.warn(`Bucket "${STORAGE_BUCKET}" not found in list. Available: ${availableNames}. Will try upload anyway.`)
      }

      // Check if bucket is public
      const bucket = buckets?.find(b => b.name === STORAGE_BUCKET)
      if (bucket && !bucket.public) {
        console.warn(`Bucket "${STORAGE_BUCKET}" exists but is not public. This may cause issues.`)
      }
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${folder}/${fileName}`

    // Try to upload directly - this will give us a better error message if bucket doesn't exist
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Error uploading file:', error)
      
      // Provide more helpful error messages
      let errorMessage = error.message
      if (error.message.includes('Bucket not found') || error.message.includes('not found')) {
        errorMessage = `Bucket "${STORAGE_BUCKET}" not found. Please create it in Supabase Dashboard → Storage → New bucket (name: "${STORAGE_BUCKET}", make it public).`
      } else if (error.message.includes('new row violates row-level security')) {
        errorMessage = `Permission denied. Please check RLS policies for bucket "${STORAGE_BUCKET}" or make it public.`
      } else if (error.message.includes('The resource already exists')) {
        errorMessage = `File with this name already exists. Please try again.`
      }
      
      return { url: '', path: '', error: errorMessage }
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    return {
      url: publicUrl,
      path: filePath
    }
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return { url: '', path: '', error: error.message || 'Upload failed' }
  }
}

/**
 * Get file type from file name or MIME type
 */
export function getFileType(file: File): string {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const mimeType = file.type

  if (mimeType.includes('pdf')) return 'pdf'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'docx'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'xlsx'
  if (mimeType.includes('image')) return 'image'
  if (ext) return ext
  return 'unknown'
}

/**
 * Convert Google Docs/Sheets/Slides URL to export URL
 * Supports:
 * - docs.google.com/document/d/{id}
 * - docs.google.com/spreadsheets/d/{id}
 * - docs.google.com/presentation/d/{id}
 */
export function convertGoogleDocsUrl(url: string, format: 'pdf' | 'docx' | 'xlsx' = 'pdf'): string {
  try {
    const urlObj = new URL(url)
    
    // Google Docs
    const docMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/)
    if (docMatch) {
      const docId = docMatch[1]
      return `https://docs.google.com/document/d/${docId}/export?format=${format === 'pdf' ? 'pdf' : 'docx'}`
    }
    
    // Google Sheets
    const sheetMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (sheetMatch) {
      const sheetId = sheetMatch[1]
      return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=${format === 'pdf' ? 'pdf' : 'xlsx'}`
    }
    
    // Google Slides
    const slideMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9-_]+)/)
    if (slideMatch) {
      const slideId = slideMatch[1]
      return `https://docs.google.com/presentation/d/${slideId}/export/${format === 'pdf' ? 'pdf' : 'pptx'}`
    }
    
    // If it's already an export URL or doesn't match, return as is
    return url
  } catch {
    // If URL parsing fails, return original
    return url
  }
}

/**
 * Check if URL is a Google Docs/Sheets/Slides URL
 */
export function isGoogleDocsUrl(url: string): boolean {
  return /docs\.google\.com\/(document|spreadsheets|presentation)\/d\//.test(url)
}

