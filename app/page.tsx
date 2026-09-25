import Link from "next/link";

const INDIAN_STYLES = ["Modern Indian", "Kerala Traditional", "Chettinad", "Rajasthani", "Indo-Contemporary"];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-10">
      <section className="space-y-4">
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          See your room redesigned before you spend a rupee.
        </h1>
        <p className="text-lg text-muted">
          Upload one photo and get design concepts for your own room in under a minute, in Indian and global
          styles, with budgets in rupees.
        </p>
        <Link href="/new" className="btn-primary inline-block max-w-xs text-center">Try with your room</Link>
      </section>

      {/* Phase 6: replace with a before/after slider built from the pre-generated demo rooms (rooms.is_demo). */}

      <section className="grid gap-4 sm:grid-cols-3">
        <Feature title="Made for Indian homes" body={INDIAN_STYLES.join(" · ")} />
        <Feature title="Priced in rupees" body="Refresh under ₹25k, Mid ₹25k–1L, or Premium, with an AI cost estimate." />
        <Feature title="Renter mode" body="Decor, textiles and lighting only. No paint, no drilling, nothing structural." />
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1 rounded-2xl bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted">{body}</p>
    </div>
  );
}
