export const safe = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (v) =>
  (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export const dateBR = (s) =>
  s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—";
export const errorMessage = (e) => e?.message || String(e) || "Erro inesperado";
export const parseBRL = (value) => {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s/g, "");
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const number = Number(normalized);
  if (!raw || !Number.isFinite(number) || number <= 0 || number > 10000000)
    throw new Error("Informe um valor positivo válido");
  return number;
};
