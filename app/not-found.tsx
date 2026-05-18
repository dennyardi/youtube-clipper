import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-md border border-line bg-white p-6 shadow-soft">
      <h1 className="text-xl font-semibold">Halaman tidak ditemukan</h1>
      <Link className="mt-4 inline-block text-sm font-medium text-brand" href="/analysis/long">
        Kembali ke dashboard
      </Link>
    </div>
  );
}
