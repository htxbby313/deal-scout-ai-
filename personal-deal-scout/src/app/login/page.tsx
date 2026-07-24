import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form action={loginAction} className="w-full rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Private owner access</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Deal Scout AI</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in with the single owner account configured on the server.</p>
        {error ? <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">Invalid username or password.</p> : null}
        <label className="mt-6 block text-sm font-medium text-slate-700">Username<input name="username" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <label className="mt-4 block text-sm font-medium text-slate-700">Password<input name="password" type="password" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" /></label>
        <button className="mt-6 w-full rounded-md bg-blue-700 px-4 py-2 font-medium text-white">Sign in</button>
      </form>
    </main>
  );
}
