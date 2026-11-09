export function approvedClosings(closings, eventId) {
  return closings.filter(
    (x) => x.status === "approved" && (!eventId || x.event_id === eventId),
  );
}
export function totalAmount(closings) {
  return closings.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}
export function comparison(closings, stalls, leftId, rightId) {
  const left = approvedClosings(closings, leftId);
  const right = approvedClosings(closings, rightId);
  const a = totalAmount(left),
    b = totalAmount(right);
  return {
    leftTotal: a,
    rightTotal: b,
    delta: b - a,
    percent: a ? ((b - a) / a) * 100 : null,
    leftCount: left.length,
    rightCount: right.length,
    stalls: stalls
      .map((stall) => {
        const x = totalAmount(left.filter((c) => c.stall_id === stall.id));
        const y = totalAmount(right.filter((c) => c.stall_id === stall.id));
        return {
          id: stall.id,
          name: stall.name,
          emoji: stall.emoji,
          left: x,
          right: y,
          delta: y - x,
          percent: x ? ((y - x) / x) * 100 : null,
        };
      })
      .sort((p, q) => Math.abs(q.delta) - Math.abs(p.delta)),
  };
}
export function filterClosings(
  closings,
  filters,
  stallName,
  eventName,
  profileName,
) {
  return closings.filter((x) => {
    if (filters.event && x.event_id !== filters.event) return false;
    if (filters.stall && x.stall_id !== filters.stall) return false;
    if (filters.status && x.status !== filters.status) return false;
    if (filters.search) {
      const needle = filters.search.toLocaleLowerCase("pt-BR");
      return [
        stallName(x.stall_id),
        eventName(x.event_id),
        profileName(x.submitted_by),
        x.note,
        x.review_note,
      ].some((v) =>
        String(v || "")
          .toLocaleLowerCase("pt-BR")
          .includes(needle),
      );
    }
    return true;
  });
}
export function asCsv(rows) {
  const cols = [
    "id",
    "event_id",
    "stall_id",
    "closing_date",
    "amount",
    "status",
    "created_at",
  ];
  return [cols, ...rows.map((r) => cols.map((c) => r[c] ?? ""))]
    .map((row) =>
      row.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(";"),
    )
    .join("\r\n");
}
