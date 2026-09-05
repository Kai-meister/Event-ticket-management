import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const dbPath = path.join(__dirname, "db.json");

const readDb = () => JSON.parse(fs.readFileSync(dbPath, "utf8"));

const sendJson = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  });
  res.end(payload);
};

const sendEmptyJson = (res, status = 200) => sendJson(res, status, {});

const paginate = (items, page, size) => {
  const pageNumber = Number.isFinite(page) && page >= 0 ? page : 0;
  const pageSize = Number.isFinite(size) && size > 0 ? size : 20;
  const totalElements = items.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / pageSize));
  const start = pageNumber * pageSize;
  const content = items.slice(start, start + pageSize);
  const numberOfElements = content.length;

  return {
    content,
    pageable: {
      sort: { empty: true, sorted: false, unsorted: true },
      offset: start,
      pageNumber,
      pageSize,
      paged: true,
      unpaged: false,
    },
    last: pageNumber >= totalPages - 1 || totalElements === 0,
    totalElements,
    totalPages: totalElements === 0 ? 0 : totalPages,
    size: pageSize,
    number: pageNumber,
    sort: { empty: true, sorted: false, unsorted: true },
    first: pageNumber === 0,
    numberOfElements,
    empty: numberOfElements === 0,
  };
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });

const toTicketSummary = (ticket) => {
  if (ticket.ticketType) {
    return {
      id: ticket.id,
      status: ticket.status,
      ticketType: ticket.ticketType,
    };
  }

  return {
    id: ticket.id,
    status: ticket.status,
    ticketType: {
      id: ticket.id,
      name: ticket.description || "Ticket",
      price: ticket.price ?? 0,
    },
  };
};

const matchPath = (pathname, pattern) => {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i];
    const actual = pathParts[i];
    if (expected.startsWith(":")) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
};

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: "Bad request" });
      return;
    }

    if (req.method === "OPTIONS") {
      sendEmptyJson(res, 204);
      return;
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    // Vite rewrites /api/v1/... -> /...
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const page = Number.parseInt(url.searchParams.get("page") ?? "0", 10);
    const size = Number.parseInt(url.searchParams.get("size") ?? "20", 10);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const db = readDb();

    if (req.method === "GET" && pathname === "/published-events") {
      let items = db["published-events"] ?? [];
      if (q) {
        items = items.filter(
          (event) =>
            event.name?.toLowerCase().includes(q) ||
            event.venue?.toLowerCase().includes(q),
        );
      }
      const summaries = items.map(
        ({ id, name, start, end, venue }) => ({
          id,
          name,
          start,
          end,
          venue,
        }),
      );
      sendJson(res, 200, paginate(summaries, page, size));
      return;
    }

    {
      const params = matchPath(pathname, "/published-events/:id");
      if (req.method === "GET" && params) {
        const event = (db["published-events"] ?? []).find(
          (item) => item.id === params.id,
        );
        if (!event) {
          sendJson(res, 404, { error: "Published event not found" });
          return;
        }
        sendJson(res, 200, {
          id: event.id,
          name: event.name,
          start: event.start,
          end: event.end,
          venue: event.venue,
          ticketTypes: (event.ticketTypes ?? []).map(
            ({ id, name, price, description }) => ({
              id,
              name,
              price,
              description,
            }),
          ),
        });
        return;
      }
    }

    if (req.method === "GET" && pathname === "/events") {
      sendJson(res, 200, paginate(db.events ?? [], page, size));
      return;
    }

    if (req.method === "POST" && pathname === "/events") {
      const body = await readBody(req);
      const event = {
        id: crypto.randomUUID(),
        ...body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.events = [...(db.events ?? []), event];
      if (event.status === "PUBLISHED") {
        db["published-events"] = [...(db["published-events"] ?? []), event];
      }
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      sendEmptyJson(res, 200);
      return;
    }

    {
      const params = matchPath(pathname, "/events/:id");
      if (params) {
        const index = (db.events ?? []).findIndex(
          (item) => item.id === params.id,
        );
        if (req.method === "GET") {
          if (index < 0) {
            sendJson(res, 404, { error: "Event not found" });
            return;
          }
          sendJson(res, 200, db.events[index]);
          return;
        }
        if (req.method === "PUT") {
          if (index < 0) {
            sendJson(res, 404, { error: "Event not found" });
            return;
          }
          const body = await readBody(req);
          db.events[index] = {
            ...db.events[index],
            ...body,
            id: params.id,
            updatedAt: new Date().toISOString(),
          };
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          sendEmptyJson(res, 200);
          return;
        }
        if (req.method === "DELETE") {
          if (index < 0) {
            sendJson(res, 404, { error: "Event not found" });
            return;
          }
          db.events.splice(index, 1);
          db["published-events"] = (db["published-events"] ?? []).filter(
            (item) => item.id !== params.id,
          );
          fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
          sendEmptyJson(res, 200);
          return;
        }
      }
    }

    {
      const params = matchPath(
        pathname,
        "/events/:eventId/ticket-types/:ticketTypeId/tickets",
      );
      if (req.method === "POST" && params) {
        const event =
          (db.events ?? []).find((item) => item.id === params.eventId) ||
          (db["published-events"] ?? []).find(
            (item) => item.id === params.eventId,
          );
        const ticketType = (event?.ticketTypes ?? []).find(
          (item) => item.id === params.ticketTypeId,
        );
        const ticket = {
          id: crypto.randomUUID(),
          status: "PURCHASED",
          price: ticketType?.price ?? 0,
          description: ticketType?.description || ticketType?.name || "Ticket",
          eventName: event?.name || "Event",
          eventVenue: event?.venue || "Venue",
          eventStart: event?.start,
          eventEnd: event?.end,
          ticketType: {
            id: ticketType?.id || params.ticketTypeId,
            name: ticketType?.name || "Ticket",
            price: ticketType?.price ?? 0,
          },
        };
        db.tickets = [...(db.tickets ?? []), ticket];
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
        sendEmptyJson(res, 200);
        return;
      }
    }

    if (req.method === "GET" && pathname === "/tickets") {
      const summaries = (db.tickets ?? []).map(toTicketSummary);
      sendJson(res, 200, paginate(summaries, page, size));
      return;
    }

    {
      const params = matchPath(pathname, "/tickets/:id");
      if (req.method === "GET" && params) {
        const ticket = (db.tickets ?? []).find((item) => item.id === params.id);
        if (!ticket) {
          sendJson(res, 404, { error: "Ticket not found" });
          return;
        }
        sendJson(res, 200, {
          id: ticket.id,
          status: ticket.status,
          price: ticket.price,
          description: ticket.description,
          eventName: ticket.eventName,
          eventVenue: ticket.eventVenue,
          eventStart: ticket.eventStart,
          eventEnd: ticket.eventEnd,
        });
        return;
      }
    }

    {
      const params = matchPath(pathname, "/tickets/:id/qr-codes");
      if (req.method === "GET" && params) {
        const ticket = (db.tickets ?? []).find((item) => item.id === params.id);
        if (!ticket) {
          sendJson(res, 404, { error: "Ticket not found" });
          return;
        }
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
  <rect width="100%" height="100%" fill="#fff"/>
  <rect x="20" y="20" width="160" height="160" fill="#000"/>
  <text x="100" y="105" fill="#fff" font-size="12" text-anchor="middle">${ticket.id.slice(0, 8)}</text>
</svg>`;
        res.writeHead(200, {
          "Content-Type": "image/svg+xml",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(svg);
        return;
      }
    }

    if (req.method === "POST" && pathname === "/ticket-validations") {
      const body = await readBody(req);
      const ticket = (db.tickets ?? []).find((item) => item.id === body?.id);
      sendJson(res, 200, {
        ticketId: body?.id,
        status: ticket ? "VALID" : "INVALID",
      });
      return;
    }

    sendJson(res, 404, { error: `No mock route for ${req.method} ${pathname}` });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Mock API listening on http://localhost:${PORT}`);
});
