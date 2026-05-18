import { redirect } from 'next/navigation'
export default function Page({ params }: { params: { id: string } }) {
  redirect(`/v2/conversation/${params.id}`)
}
