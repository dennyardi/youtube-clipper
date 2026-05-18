import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
  const logs = await prisma.errorLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <PageHeader title="Log Error" description="Pelacakan error proses subtitle, OpenAI, Python scorer, download, dan API dashboard." />
      <div className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-panel">
            <tr>
              <th className="border-b border-line px-4 py-3">Waktu</th>
              <th className="border-b border-line px-4 py-3">Scope</th>
              <th className="border-b border-line px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-muted">{log.createdAt.toLocaleString("id-ID")}</td>
                <td className="px-4 py-3 font-medium">{log.scope}</td>
                <td className="px-4 py-3 text-muted">{log.message}</td>
              </tr>
            ))}
            {!logs.length && (
              <tr>
                <td className="px-4 py-6 text-muted" colSpan={3}>
                  Belum ada log error.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
