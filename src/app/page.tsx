import { redirect } from 'next/navigation';

export default function HomePage() {
  // Redireccionar automáticamente a /login
  redirect('/login');
}
