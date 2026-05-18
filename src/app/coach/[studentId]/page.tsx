import { redirect } from 'next/navigation'
export default function Page({ params }: { params: { studentId: string } }) {
  redirect(`/v2/coach/${params.studentId}`)
}
