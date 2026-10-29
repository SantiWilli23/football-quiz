import { db } from "../db/client.js";
import { CARDS } from "../routes/cards.js";

// Mercado de cartas (Futotal 2.0): subastas entre miembros de un mismo club, solo con las monedas
// del juego (las de vender cartas), nunca con dinero real. La carta sale del vendedor al publicar
// (así no se puede gastar dos veces) y vuelve si nadie puja. Se pagan 5% de comisión, que sale de
// circulación. Las subastas vencidas se cierran al consultar el mercado, no con un reloj, para que
// funcione aunque el servidor haya estado dormido.
export const HOURS = 24;
export const FEE = 0.05;
export const MAX_OPEN_PER_USER = 3;
const SELL_VALUE = { estrella: 120, oro: 40, plata: 15, bronce: 5 };
const BY_NAME = new Map(CARDS.map((c) => [c.name, c]));

export const suggestedPrice = (card) => (SELL_VALUE[card.tier] || 5) * 2;
export const minRaise = (top) => Math.max(1, Math.ceil(top * 0.05));
const pubCard = (c) => ({ name: c.name, realName: c.realName, special: c.special, note: c.note || null, tier: c.tier, tierLabel: c.tierLabel, ovr: c.ovr, pos: c.pos, nationality: c.nationality, club: c.club });

const nowIso = (d = new Date()) => d.toISOString().replace("T", " ").slice(0, 19);

async function bump(tx, user, name, delta) {
  await tx.execute({
    sql: "INSERT INTO user_cards (user_id, player_name, count) VALUES (?, ?, ?) ON CONFLICT(user_id, player_name) DO UPDATE SET count = count + ?",
    args: [user, name, Math.max(delta, 0), delta],
  });
}
async function wallet(tx, user, delta) {
  await tx.execute({
    sql: `INSERT INTO card_wallets (user_id, balance, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET balance = balance + excluded.balance, updated_at = excluded.updated_at`,
    args: [user, delta],
  });
}
async function balanceOf(tx, user) {
  return Number((await tx.execute({ sql: "SELECT balance FROM card_wallets WHERE user_id = ?", args: [user] })).rows[0]?.balance || 0);
}
async function logHistory(tx, card, from, to, kind, price) {
  await tx.execute({ sql: "INSERT INTO card_history (card, from_user, to_user, kind, price) VALUES (?, ?, ?, ?, ?)", args: [card, from, to, kind, price] });
}

// Cierra las subastas vencidas: a quien pujó más le llega la carta y el vendedor cobra; sin pujas,
// la carta vuelve al vendedor.
export async function settleExpired(now = new Date()) {
  const due = (await db.execute({ sql: "SELECT * FROM market_listings WHERE status = 'open' AND ends_at <= ? ORDER BY id", args: [nowIso(now)] })).rows;
  for (const l of due) {
    const tx = await db.transaction("write");
    try {
      const still = (await tx.execute({ sql: "SELECT status FROM market_listings WHERE id = ?", args: [l.id] })).rows[0];
      if (still?.status !== "open") { await tx.rollback(); continue; }
      const top = (await tx.execute({ sql: "SELECT user_id, amount FROM market_bids WHERE listing_id = ? ORDER BY amount DESC, id ASC LIMIT 1", args: [l.id] })).rows[0];
      if (top) {
        const price = Number(top.amount);
        const fee = Math.max(1, Math.floor(price * FEE));
        await bump(tx, top.user_id, l.card, 1);
        await wallet(tx, l.seller_id, price - fee);
        await logHistory(tx, l.card, l.seller_id, top.user_id, "subasta", price);
        await tx.execute({ sql: "UPDATE market_listings SET status = 'sold', winner_id = ?, price = ? WHERE id = ?", args: [top.user_id, price, l.id] });
      } else {
        await bump(tx, l.seller_id, l.card, 1);
        await tx.execute({ sql: "UPDATE market_listings SET status = 'expired' WHERE id = ?", args: [l.id] });
      }
      await tx.commit();
    } catch (e) { await tx.rollback(); throw e; }
  }
  return due.length;
}

async function clubsOf(userId) {
  return (await db.execute({ sql: "SELECT group_id FROM group_members WHERE user_id = ?", args: [userId] })).rows.map((r) => Number(r.group_id));
}

export async function listOpen(userId, now = new Date()) {
  await settleExpired(now);
  const groups = await clubsOf(userId);
  if (!groups.length) return { listings: [], mine: [], balance: await balanceOf(db, userId), noClub: true };
  const ph = groups.map(() => "?").join(",");
  const rows = (await db.execute({
    sql: `SELECT l.*, u.username AS seller_name,
            (SELECT MAX(amount) FROM market_bids WHERE listing_id = l.id) AS top,
            (SELECT user_id FROM market_bids WHERE listing_id = l.id ORDER BY amount DESC, id ASC LIMIT 1) AS top_user
          FROM market_listings l JOIN users u ON u.id = l.seller_id
          WHERE l.status = 'open' AND l.group_id IN (${ph}) ORDER BY l.ends_at ASC`,
    args: groups,
  })).rows;
  const shape = (r) => {
    const card = BY_NAME.get(r.card);
    const top = r.top === null || r.top === undefined ? null : Number(r.top);
    return {
      id: Number(r.id), card: card ? pubCard(card) : { name: r.card }, seller: { id: Number(r.seller_id), username: r.seller_name },
      base: Number(r.base), top, minBid: top === null ? Number(r.base) : top + minRaise(top), endsAt: r.ends_at,
      mine: Number(r.seller_id) === userId, leading: top !== null && Number(r.top_user) === userId, suggested: card ? suggestedPrice(card) : null,
    };
  };
  const all = rows.map(shape);
  return { listings: all.filter((l) => !l.mine), mine: all.filter((l) => l.mine), balance: await balanceOf(db, userId) };
}

export async function publish(userId, name, base, now = new Date()) {
  const card = BY_NAME.get(name);
  if (!card) return { error: "Esa carta no existe" };
  const groups = await clubsOf(userId);
  if (!groups.length) return { error: "Necesitas un club para usar el mercado" };
  const price = Math.floor(Number(base));
  if (!Number.isFinite(price) || price < 1) return { error: "Pon un precio de salida" };
  if (price > suggestedPrice(card) * 10) return { error: "Ese precio de salida es demasiado alto" };
  const open = Number((await db.execute({ sql: "SELECT COUNT(*) AS n FROM market_listings WHERE seller_id = ? AND status = 'open'", args: [userId] })).rows[0].n);
  if (open >= MAX_OPEN_PER_USER) return { error: `Solo puedes tener ${MAX_OPEN_PER_USER} subastas abiertas` };
  const tx = await db.transaction("write");
  try {
    const have = Number((await tx.execute({ sql: "SELECT count FROM user_cards WHERE user_id = ? AND player_name = ?", args: [userId, name] })).rows[0]?.count || 0);
    if (have < 2) { await tx.rollback(); return { error: "Solo puedes subastar cartas repetidas" }; }
    await bump(tx, userId, name, -1);
    const ins = await tx.execute({
      sql: "INSERT INTO market_listings (seller_id, group_id, card, base, ends_at) VALUES (?, ?, ?, ?, ?)",
      args: [userId, groups[0], name, price, nowIso(new Date(now.getTime() + HOURS * 3600 * 1000))],
    });
    await tx.commit();
    return { ok: true, id: Number(ins.lastInsertRowid) };
  } catch (e) { await tx.rollback(); throw e; }
}

export async function bid(userId, listingId, amount, now = new Date()) {
  await settleExpired(now);
  const l = (await db.execute({ sql: "SELECT * FROM market_listings WHERE id = ?", args: [listingId] })).rows[0];
  if (!l || l.status !== "open") return { error: "Esa subasta ya terminó" };
  if (Number(l.seller_id) === userId) return { error: "No puedes pujar por tu propia carta" };
  if (!(await clubsOf(userId)).includes(Number(l.group_id))) return { error: "Esa subasta es de otro club" };
  const value = Math.floor(Number(amount));
  const tx = await db.transaction("write");
  try {
    const top = (await tx.execute({ sql: "SELECT user_id, amount FROM market_bids WHERE listing_id = ? ORDER BY amount DESC, id ASC LIMIT 1", args: [listingId] })).rows[0];
    const min = top ? Number(top.amount) + minRaise(Number(top.amount)) : Number(l.base);
    if (!Number.isFinite(value) || value < min) { await tx.rollback(); return { error: `La puja mínima es ${min}` }; }
    // Si ya eres quien lidera, solo se cobra la diferencia.
    const mineBefore = top && Number(top.user_id) === userId ? Number(top.amount) : 0;
    if ((await balanceOf(tx, userId)) < value - mineBefore) { await tx.rollback(); return { error: "No te alcanzan las monedas" }; }
    if (top && Number(top.user_id) !== userId) await wallet(tx, top.user_id, Number(top.amount));
    await wallet(tx, userId, -(value - mineBefore));
    await tx.execute({ sql: "INSERT INTO market_bids (listing_id, user_id, amount) VALUES (?, ?, ?)", args: [listingId, userId, value] });
    await tx.commit();
    return { ok: true, amount: value };
  } catch (e) { await tx.rollback(); throw e; }
}

export async function cancel(userId, listingId) {
  const tx = await db.transaction("write");
  try {
    const l = (await tx.execute({ sql: "SELECT * FROM market_listings WHERE id = ?", args: [listingId] })).rows[0];
    if (!l || Number(l.seller_id) !== userId) { await tx.rollback(); return { error: "Subasta no encontrada" }; }
    if (l.status !== "open") { await tx.rollback(); return { error: "Esa subasta ya terminó" }; }
    const bids = Number((await tx.execute({ sql: "SELECT COUNT(*) AS n FROM market_bids WHERE listing_id = ?", args: [listingId] })).rows[0].n);
    if (bids > 0) { await tx.rollback(); return { error: "Ya hay pujas: no se puede cancelar" }; }
    await bump(tx, userId, l.card, 1);
    await tx.execute({ sql: "UPDATE market_listings SET status = 'cancelled' WHERE id = ?", args: [listingId] });
    await tx.commit();
    return { ok: true };
  } catch (e) { await tx.rollback(); throw e; }
}

// Quién tuvo la carta antes: últimas 10 operaciones (subastas y trueques).
export async function historyOf(name) {
  const rows = (await db.execute({
    sql: `SELECT h.kind, h.price, h.at, f.username AS from_name, t.username AS to_name
          FROM card_history h LEFT JOIN users f ON f.id = h.from_user LEFT JOIN users t ON t.id = h.to_user
          WHERE h.card = ? ORDER BY h.id DESC LIMIT 10`,
    args: [name],
  })).rows;
  return rows.map((r) => ({ kind: r.kind, price: r.price === null ? null : Number(r.price), at: r.at, from: r.from_name, to: r.to_name }));
}
