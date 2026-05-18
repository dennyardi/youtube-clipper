import { LoginForm } from "@/components/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4">
      <div className="w-full max-w-sm rounded-md border border-line bg-white p-6 shadow-soft">
        <div className="mb-5">
          <h1 className="text-xl font-semibold">Youtube Clipper Maker</h1>
          <p className="mt-1 text-sm text-muted">Masuk untuk mengelola dashboard.</p>
        </div>
        <LoginForm nextPath={params.next || "/analysis/long"} />
      </div>
    </main>
  );
}
