import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { CreateRoomForm } from './CreateRoomForm';

export default async function NewRoomPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-900 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">
          Create a new room
        </h1>
      </header>
      <section className="max-w-2xl mx-auto px-6 py-10">
        <CreateRoomForm />
      </section>
    </main>
  );
}
