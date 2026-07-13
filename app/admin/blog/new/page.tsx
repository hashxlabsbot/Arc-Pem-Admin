import BlogEditor, { emptyForm } from '../BlogEditor'

export const dynamic = 'force-dynamic'

export default function NewBlogPostPage() {
  return <BlogEditor initial={emptyForm} mode="new" />
}
