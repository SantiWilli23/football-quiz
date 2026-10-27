import { EventEmitter } from "node:events";

// Bus de eventos en memoria: cuando alguien suma puntos a un club, los que están mirando la
// tabla lo ven en vivo («Juan acaba de sacar 82»). Un solo proceso, sin Redis.
export const bus = new EventEmitter();
bus.setMaxListeners(0);
