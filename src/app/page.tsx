import { redirect } from 'next/navigation';
import { getSession } from '@/actions/auth';

export const revalidate = 0;

export default async function HomePage() {
  const session = await getSession();

  if (session) {
    if (session.role === 'admin') {
      redirect('/admin');
    } else {
      redirect('/dashboard');
    }
  }

  redirect('/login');
}
