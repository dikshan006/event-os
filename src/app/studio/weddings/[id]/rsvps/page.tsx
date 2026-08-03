import { requireStudio, ownWedding } from "@/server/services/context";
import { listGuests } from "@/server/services/guests";
import { PageHead, StatusChip } from "@/components/ui";
import { initials } from "@/lib/utils";

export default async function RsvpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const guests = await listGuests(studioId, w.id);
  const count = (s: string) => guests.filter(g => (g.rsvp?.status ?? "AWAITING") === s).length;

  return (
    <>
      <PageHead back={`/studio/weddings/${w.id}`} eyebrow={`${w.partnerOne} & ${w.partnerTwo}`} title="RSVP Tracking"
        sub="Responses land here instantly as guests reply through their invitation links." />
      <div className="stats">
        {["ACCEPTED", "DECLINED", "MAYBE", "AWAITING"].map(s => (
          <div key={s} className="card stat"><div className="v">{count(s)}</div>
            <div className="l">{s.charAt(0) + s.slice(1).toLowerCase()}</div></div>
        ))}
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Guest</th><th>Response</th><th>Meal</th><th>Dietary</th><th>Notes</th></tr></thead>
          <tbody>
            {guests.map(g => (
              <tr key={g.id}>
                <td><div className="row"><div className="ava" style={{ width: 32, height: 32, fontSize: 11 }}>{initials(g.name)}</div>{g.name}</div></td>
                <td><StatusChip s={g.rsvp?.status ?? "AWAITING"} /></td>
                <td className="meta">{g.rsvp?.meal ?? "—"}</td>
                <td className="meta">{g.rsvp?.dietary ?? "—"}</td>
                <td className="meta">{g.rsvp?.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
