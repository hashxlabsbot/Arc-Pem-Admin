import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { put } from '@vercel/blob'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml']

/** Slugify a filename to keep the blob key tidy — the random suffix guarantees uniqueness. */
function safeName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'image'
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : 'png'
  return `blog/${base}.${ext}`
}

/** Upload a blog image to Vercel Blob and return its public CDN URL. ADMIN only. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      logger.error('POST /api/blog/upload: BLOB_READ_WRITE_TOKEN not configured')
      return NextResponse.json({ error: 'Image storage is not configured.' }, { status: 500 })
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
    }
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type. Use JPG, PNG, WEBP, GIF, AVIF or SVG.' }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image is larger than 5 MB.' }, { status: 400 })
    }

    const blob = await put(safeName(file.name), file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    logger.error('POST /api/blog/upload failed', err)
    return NextResponse.json({ error: 'Upload failed. Please try again.' }, { status: 500 })
  }
}
