'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Eye, Pencil, RefreshCw, ExternalLink, ImagePlus, Upload, X, Crop } from 'lucide-react'
import { BLOG_CATEGORIES, BLOG_RELATED_TOOLS } from '@/lib/blog-constants'
import { ImageCropModal, type AspectOption } from '@/components/admin/ImageCropModal'

type ImgSize = 'small' | 'medium' | 'full'
const IMG_SIZES: { value: ImgSize; label: string; hint: string }[] = [
  { value: 'small', label: 'Small', hint: '≈360px' },
  { value: 'medium', label: 'Medium', hint: '≈640px' },
  { value: 'full', label: 'Full', hint: 'Column width' },
]

// SVGs are vector (cropping to a raster canvas defeats the point) and GIFs are
// often animated (canvas cropping would flatten them to one frame) — skip the
// crop step for both and upload as-is.
const SKIP_CROP_TYPES = new Set(['image/svg+xml', 'image/gif'])
const COVER_ASPECT = 1200 / 630 // standard OG/social card ratio
const BODY_ASPECT_OPTIONS: AspectOption[] = [
  { label: 'Free', value: null },
  { label: 'Square', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
]

interface PendingCrop { src: string; file: File; forExisting?: boolean }

/** Upload an image to Vercel Blob via the admin API; returns its public URL or throws. */
async function uploadImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/blog/upload', { method: 'POST', body })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Upload failed.')
  return data.url as string
}

export interface BlogFormData {
  id?: string
  slug: string
  title: string
  description: string
  contentMarkdown: string
  category: string
  tags: string[]
  authorName: string
  authorRole: string
  coverImage: string
  coverImageAlt: string
  seoTitle: string
  featured: boolean
  status: string
  publishedAt: string // yyyy-mm-dd or ''
  updatedDate: string
  relatedTools: string[]
  relatedPosts: string[]
  faq: { q: string; a: string }[]
  howto: { name: string; description: string; steps: { name: string; text: string }[] } | null
}

export const emptyForm: BlogFormData = {
  slug: '', title: '', description: '', contentMarkdown: '', category: BLOG_CATEGORIES[0],
  tags: [], authorName: '', authorRole: '', coverImage: '', coverImageAlt: '', seoTitle: '',
  featured: false, status: 'DRAFT', publishedAt: '', updatedDate: '', relatedTools: [], relatedPosts: [],
  faq: [], howto: null,
}

function slugify(s: string) {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const labelCls = 'block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5'
const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400'

export default function BlogEditor({ initial, mode }: { initial: BlogFormData; mode: 'new' | 'edit' }) {
  const router = useRouter()
  const [form, setForm] = useState<BlogFormData>(initial)
  const [slugTouched, setSlugTouched] = useState(mode === 'edit')
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedId, setSavedId] = useState<string | undefined>(initial.id)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // Inline-image insertion flow
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const cursorRef = useRef<number | null>(null)
  const bodyFileRef = useRef<HTMLInputElement>(null)
  const coverFileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [pendingImg, setPendingImg] = useState<{ url: string; size: ImgSize; alt: string; caption: string } | null>(null)
  const [coverCrop, setCoverCrop] = useState<PendingCrop | null>(null)
  const [bodyCrop, setBodyCrop] = useState<PendingCrop | null>(null)
  const [coverRecropLoading, setCoverRecropLoading] = useState(false)

  function set<K extends keyof BlogFormData>(key: K, value: BlogFormData[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  /** Remember where the caret is so we can splice the image markdown back in later. */
  function rememberCursor() {
    cursorRef.current = bodyRef.current?.selectionStart ?? form.contentMarkdown.length
  }

  async function onPickBodyImage(file: File | undefined) {
    if (!file) return
    if (bodyFileRef.current) bodyFileRef.current.value = ''
    if (SKIP_CROP_TYPES.has(file.type)) {
      setError(''); setUploading(true)
      try {
        const url = await uploadImage(file)
        setPendingImg({ url, size: 'medium', alt: '', caption: '' })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.')
      } finally {
        setUploading(false)
      }
      return
    }
    setBodyCrop({ src: URL.createObjectURL(file), file })
  }

  async function onBodyCropConfirm(blob: Blob) {
    if (!bodyCrop) return
    setError(''); setUploading(true)
    const { src, file } = bodyCrop
    try {
      const cropped = new File([blob], file.name, { type: blob.type })
      const url = await uploadImage(cropped)
      setPendingImg({ url, size: 'medium', alt: '', caption: '' })
      setBodyCrop(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setUploading(false)
      URL.revokeObjectURL(src)
    }
  }

  function onBodyCropCancel() {
    if (bodyCrop) URL.revokeObjectURL(bodyCrop.src)
    setBodyCrop(null)
  }

  /** Splice the composed markdown image at the remembered caret position. */
  function insertPendingImage() {
    if (!pendingImg) return
    const { url, size, alt, caption } = pendingImg
    const titlePart = caption.trim() ? ` "${caption.trim().replace(/"/g, "'")}"` : ''
    const md = `\n\n![${alt.trim()}](${url}#${size}${titlePart})\n\n`
    const pos = cursorRef.current ?? form.contentMarkdown.length
    const next = form.contentMarkdown.slice(0, pos) + md + form.contentMarkdown.slice(pos)
    set('contentMarkdown', next)
    setPendingImg(null)
    cursorRef.current = pos + md.length
  }

  async function onPickCoverImage(file: File | undefined) {
    if (!file) return
    if (coverFileRef.current) coverFileRef.current.value = ''
    if (SKIP_CROP_TYPES.has(file.type)) {
      setError(''); setCoverUploading(true)
      try {
        set('coverImage', await uploadImage(file))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed.')
      } finally {
        setCoverUploading(false)
      }
      return
    }
    setCoverCrop({ src: URL.createObjectURL(file), file })
  }

  /** Re-open the cropper on the cover image that's already uploaded, to reposition/re-crop it. */
  async function reCropExistingCover() {
    if (!form.coverImage) return
    setError(''); setCoverRecropLoading(true)
    try {
      const res = await fetch(form.coverImage)
      if (!res.ok) throw new Error('Could not load the current cover image.')
      const blob = await res.blob()
      const type = blob.type || 'image/jpeg'
      const file = new File([blob], 'cover', { type })
      setCoverCrop({ src: URL.createObjectURL(blob), file, forExisting: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the current cover image to re-crop.')
    } finally {
      setCoverRecropLoading(false)
    }
  }

  async function onCoverCropConfirm(blob: Blob) {
    if (!coverCrop) return
    setError(''); setCoverUploading(true)
    const { src, file } = coverCrop
    try {
      const cropped = new File([blob], file.name || 'cover', { type: blob.type })
      set('coverImage', await uploadImage(cropped))
      setCoverCrop(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setCoverUploading(false)
      URL.revokeObjectURL(src)
    }
  }

  function onCoverCropCancel() {
    if (coverCrop) URL.revokeObjectURL(coverCrop.src)
    setCoverCrop(null)
  }

  function onTitleChange(v: string) {
    setForm((f) => ({ ...f, title: v, slug: slugTouched ? f.slug : slugify(v) }))
  }

  /** Create/update the post. Returns its id on success (no redirect unless asked). */
  async function submit(publish: boolean, { redirect }: { redirect: boolean }): Promise<string | null> {
    setError('')
    const status = publish ? 'PUBLISHED' : form.status
    const payload = { ...form, status }
    if (!payload.title || !payload.description || !payload.category || !payload.contentMarkdown) {
      setError('Title, description, category and content are all required.')
      return null
    }
    setSaving(true)
    try {
      const res = await fetch(savedId ? `/api/blog/${savedId}` : '/api/blog', {
        method: savedId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Save failed.'); return null }
      const id: string = data.post.id
      setSavedId(id)
      if (status !== form.status) set('status', status)
      if (redirect) { router.push('/admin/blog'); router.refresh() }
      return id
    } catch {
      setError('Network error. Please try again.')
      return null
    } finally {
      setSaving(false)
    }
  }

  /** Fetch a fresh signed preview URL (new token each call → iframe reloads). */
  async function loadPreview(id: string) {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/blog/${id}/preview`)
      const data = await res.json()
      if (res.ok) setPreviewUrl(data.url)
      else setError(data.error ?? 'Could not load preview.')
    } catch {
      setError('Could not reach the preview service.')
    } finally {
      setPreviewLoading(false)
    }
  }

  /** Save current edits in place, then (re)load the live preview iframe. */
  async function saveAndPreview() {
    const id = await submit(false, { redirect: false })
    if (id) await loadPreview(id)
  }

  function goToTab(t: 'write' | 'preview') {
    setTab(t)
    if (t === 'preview' && savedId && !previewUrl) loadPreview(savedId)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto pb-24">
      <button onClick={() => router.push('/admin/blog')} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={15} /> Back to posts
      </button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">{mode === 'new' ? 'New Post' : 'Edit Post'}</h1>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${form.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {form.status === 'PUBLISHED' ? 'Published' : 'Draft'}
        </span>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}

      <div className="space-y-6">
        {/* Core */}
        <Section title="Article">
          <Field label="Title"><input className={inputCls} value={form.title} onChange={(e) => onTitleChange(e.target.value)} placeholder="How to …" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="URL slug">
              <input className={inputCls} value={form.slug}
                onChange={(e) => { setSlugTouched(true); set('slug', slugify(e.target.value)) }}
                placeholder="how-to-…" />
              <p className="text-[11px] text-gray-400 mt-1">/blog/{form.slug || '…'}</p>
            </Field>
            <Field label="Category">
              <select className={inputCls} value={form.category} onChange={(e) => set('category', e.target.value)}>
                {BLOG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description (meta / social / card blurb — ~140-155 chars)">
            <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            <p className="text-[11px] text-gray-400 mt-1">{form.description.length} chars</p>
          </Field>
        </Section>

        {/* Body with live preview */}
        <Section title="Content (Markdown)">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <TabBtn active={tab === 'write'} onClick={() => goToTab('write')} icon={<Pencil size={13} />}>Write</TabBtn>
              <TabBtn active={tab === 'preview'} onClick={() => goToTab('preview')} icon={<Eye size={13} />}>Live Preview</TabBtn>
            </div>
            {tab === 'write' && (
              <button
                type="button"
                onClick={() => { rememberCursor(); bodyFileRef.current?.click() }}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              >
                {uploading ? <RefreshCw size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                {uploading ? 'Uploading…' : 'Insert image'}
              </button>
            )}
            <input ref={bodyFileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => onPickBodyImage(e.target.files?.[0])} />
          </div>

          {pendingImg && (
            <div className="mb-3 border border-blue-200 bg-blue-50/50 rounded-lg p-3">
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-bold text-gray-800">Insert image</p>
                <button type="button" onClick={() => setPendingImg(null)} className="p-1 text-gray-400 hover:text-red-600"><X size={14} /></button>
              </div>
              <div className="flex gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImg.url} alt="" className="w-24 h-24 object-cover rounded-md border border-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex gap-1.5">
                    {IMG_SIZES.map((s) => (
                      <button key={s.value} type="button"
                        onClick={() => setPendingImg((p) => p && { ...p, size: s.value })}
                        className={`flex-1 px-2 py-1.5 rounded-md text-xs font-semibold border transition ${pendingImg.size === s.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>
                        {s.label}<span className="block text-[10px] font-normal opacity-70">{s.hint}</span>
                      </button>
                    ))}
                  </div>
                  <input className={inputCls} placeholder="Alt text (accessibility / SEO)"
                    value={pendingImg.alt} onChange={(e) => setPendingImg((p) => p && { ...p, alt: e.target.value })} />
                  <input className={inputCls} placeholder="Caption (optional)"
                    value={pendingImg.caption} onChange={(e) => setPendingImg((p) => p && { ...p, caption: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <button type="button" onClick={insertPendingImage}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700">
                  Insert at cursor
                </button>
              </div>
            </div>
          )}

          {tab === 'write' ? (
            <>
              <textarea
                ref={bodyRef}
                className={`${inputCls} font-mono text-[13px] leading-relaxed`}
                rows={20}
                value={form.contentMarkdown}
                onChange={(e) => set('contentMarkdown', e.target.value)}
                onSelect={rememberCursor}
                placeholder={'## A heading\n\nYour article body in Markdown. Use ## and ### headings, **bold**, lists, [links](/tools), and | tables |.'}
              />
              <p className="text-[11px] text-gray-400 mt-1.5">Switch to <strong>Live Preview</strong> to see the exact published page, rendered by the marketing site.</p>
            </>
          ) : !savedId ? (
            <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center bg-gray-50">
              <p className="text-sm text-gray-600 mb-3">Save the post once to preview it as the real, published page.</p>
              <button onClick={saveAndPreview} disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save draft & preview'}
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-gray-400">Exactly how the published page looks — drafts are shown safely (not indexed, not public).</p>
                <div className="flex items-center gap-2">
                  {previewUrl && (
                    <a href={previewUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-blue-600">
                      <ExternalLink size={13} /> Open
                    </a>
                  )}
                  <button onClick={saveAndPreview} disabled={saving || previewLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60">
                    <RefreshCw size={13} className={saving || previewLoading ? 'animate-spin' : ''} />
                    {saving ? 'Saving…' : 'Save & refresh'}
                  </button>
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ height: '75vh' }}>
                {previewLoading && !previewUrl ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">Loading live preview…</div>
                ) : previewUrl ? (
                  <iframe key={previewUrl} src={previewUrl} title="Live preview" className="w-full h-full border-0" />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">Preview unavailable.</div>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* SEO / meta */}
        <Section title="SEO & Metadata">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SEO title override (optional)"><input className={inputCls} value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} placeholder="Defaults to the title" /></Field>
            <Field label="Tags (comma-separated)"><input className={inputCls} value={form.tags.join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))} placeholder="gst, billing" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Cover image path/URL (optional — else auto card)">
              <div className="flex gap-2">
                {form.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.coverImage} alt="" className="w-11 h-11 object-cover rounded-md border border-gray-200 flex-shrink-0" />
                )}
                <input className={inputCls} value={form.coverImage} onChange={(e) => set('coverImage', e.target.value)} placeholder="/images/finance-analytics.jpg or upload →" />
                {form.coverImage && (
                  <button type="button" onClick={reCropExistingCover} disabled={coverRecropLoading || coverUploading}
                    className="inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 whitespace-nowrap">
                    {coverRecropLoading ? <RefreshCw size={13} className="animate-spin" /> : <Crop size={13} />}
                    {coverRecropLoading ? '…' : 'Adjust'}
                  </button>
                )}
                <button type="button" onClick={() => coverFileRef.current?.click()} disabled={coverUploading}
                  className="inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 whitespace-nowrap">
                  {coverUploading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
                  {coverUploading ? '…' : 'Upload'}
                </button>
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => onPickCoverImage(e.target.files?.[0])} />
              </div>
            </Field>
            <Field label="Cover image alt text"><input className={inputCls} value={form.coverImageAlt} onChange={(e) => set('coverImageAlt', e.target.value)} /></Field>
          </div>
        </Section>

        {/* Author + publishing */}
        <Section title="Author & Publishing">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Author name (optional — else ARC PEM Team)"><input className={inputCls} value={form.authorName} onChange={(e) => set('authorName', e.target.value)} /></Field>
            <Field label="Author role"><input className={inputCls} value={form.authorRole} onChange={(e) => set('authorRole', e.target.value)} placeholder="Founder, HashX Labs" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Publish date (optional)"><input type="date" className={inputCls} value={form.publishedAt} onChange={(e) => set('publishedAt', e.target.value)} /></Field>
            <Field label="“Updated” date (optional — editorial signal)"><input type="date" className={inputCls} value={form.updatedDate} onChange={(e) => set('updatedDate', e.target.value)} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-1">
            <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} className="rounded" />
            Feature this post (large slot at the top of /blog)
          </label>
        </Section>

        {/* Cross-links */}
        <Section title="Cross-links">
          <Field label="Related free tool (renders an inline CTA)">
            <div className="flex flex-wrap gap-3">
              {BLOG_RELATED_TOOLS.map((t) => (
                <label key={t.slug} className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input type="checkbox" checked={form.relatedTools.includes(t.slug)}
                    onChange={(e) => set('relatedTools', e.target.checked ? [...form.relatedTools, t.slug] : form.relatedTools.filter((s) => s !== t.slug))} />
                  {t.name}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Related post slugs (comma-separated — else auto by category)">
            <input className={inputCls} value={form.relatedPosts.join(', ')} onChange={(e) => set('relatedPosts', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="some-other-slug" />
          </Field>
        </Section>

        {/* FAQ */}
        <Section title="FAQ (optional — emits FAQ rich-result schema)">
          {form.faq.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
              <div className="flex items-start gap-2">
                <input className={inputCls} placeholder="Question" value={item.q}
                  onChange={(e) => set('faq', form.faq.map((f, j) => j === i ? { ...f, q: e.target.value } : f))} />
                <button onClick={() => set('faq', form.faq.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
              <textarea className={inputCls} rows={2} placeholder="Answer" value={item.a}
                onChange={(e) => set('faq', form.faq.map((f, j) => j === i ? { ...f, a: e.target.value } : f))} />
            </div>
          ))}
          <button onClick={() => set('faq', [...form.faq, { q: '', a: '' }])} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"><Plus size={15} /> Add FAQ</button>
        </Section>

        {/* HowTo */}
        <Section title="HowTo (optional — emits step-by-step schema)">
          {form.howto ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <Field label="HowTo name"><input className={inputCls} value={form.howto.name} onChange={(e) => set('howto', { ...form.howto!, name: e.target.value })} /></Field>
                <Field label="HowTo description"><input className={inputCls} value={form.howto.description} onChange={(e) => set('howto', { ...form.howto!, description: e.target.value })} /></Field>
              </div>
              {form.howto.steps.map((step, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50/50">
                  <div className="flex items-start gap-2">
                    <input className={inputCls} placeholder={`Step ${i + 1} name`} value={step.name}
                      onChange={(e) => set('howto', { ...form.howto!, steps: form.howto!.steps.map((s, j) => j === i ? { ...s, name: e.target.value } : s) })} />
                    <button onClick={() => set('howto', { ...form.howto!, steps: form.howto!.steps.filter((_, j) => j !== i) })} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                  <textarea className={inputCls} rows={2} placeholder="Step text" value={step.text}
                    onChange={(e) => set('howto', { ...form.howto!, steps: form.howto!.steps.map((s, j) => j === i ? { ...s, text: e.target.value } : s) })} />
                </div>
              ))}
              <div className="flex gap-3">
                <button onClick={() => set('howto', { ...form.howto!, steps: [...form.howto!.steps, { name: '', text: '' }] })} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"><Plus size={15} /> Add step</button>
                <button onClick={() => set('howto', null)} className="text-sm font-medium text-gray-400 hover:text-red-600">Remove HowTo</button>
              </div>
            </div>
          ) : (
            <button onClick={() => set('howto', { name: '', description: '', steps: [{ name: '', text: '' }] })} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"><Plus size={15} /> Add a HowTo</button>
          )}
        </Section>
      </div>

      {coverCrop && (
        <ImageCropModal
          imageSrc={coverCrop.src}
          mimeType={coverCrop.file.type || 'image/jpeg'}
          title={coverCrop.forExisting ? 'Adjust cover image' : 'Crop cover image'}
          aspect={COVER_ASPECT}
          aspectHint="1200×630 — matches the featured/card/cover frames on the site and social share cards"
          confirmLabel="Use cover image"
          onCancel={onCoverCropCancel}
          onConfirm={onCoverCropConfirm}
        />
      )}

      {bodyCrop && (
        <ImageCropModal
          imageSrc={bodyCrop.src}
          mimeType={bodyCrop.file.type || 'image/jpeg'}
          title="Crop image"
          aspectOptions={BODY_ASPECT_OPTIONS}
          confirmLabel="Continue"
          onCancel={onBodyCropCancel}
          onConfirm={onBodyCropConfirm}
        />
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => submit(false, { redirect: true })} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 disabled:opacity-60">
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button onClick={() => submit(true, { redirect: true })} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
          {saving ? 'Publishing…' : form.status === 'PUBLISHED' ? 'Update & republish' : 'Publish'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-sm font-bold text-gray-900 mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={labelCls}>{label}</label>{children}</div>
}
function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}>
      {icon}{children}
    </button>
  )
}
