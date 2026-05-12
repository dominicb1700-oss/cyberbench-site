const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const send = (res, file) =>
  res.sendFile(path.join(__dirname, "public", file));

/* =========================
   In-Memory Data Store
========================= */

let nextId = 1;
let tickets = [];

/* =========================
   PAGE ROUTES
========================= */

app.get("/", (req, res) => send(res, "index.html"));
app.get("/about", (req, res) => send(res, "about.html"));
app.get("/services", (req, res) => send(res, "services.html"));
app.get("/blog", (req, res) => send(res, "blog.html"));
app.get("/submit-ticket", (req, res) => send(res, "submit-ticket.html"));
app.get("/success", (req, res) => send(res, "success.html"));
app.get("/admin", (req, res) => send(res, "admin.html"));
app.get("/kpi", (req, res) => send(res, "kpi.html"));
app.get("/client-portal", (req, res) => send(res, "client-portal.html"));
app.get("/consultant-portal", (req, res) => send(res, "consultant-portal.html"));

/* =========================
   CREATE TICKET
========================= */

app.post("/api/tickets", (req, res) => {
  const { company, name, email, phone, urgency, issue } = req.body;

  const t = {
    id: nextId++,
    company: (company || "").trim(),
    name: (name || "").trim(),
    email: (email || "").trim(),
    phone: (phone || "").trim(),
    urgency: (urgency || "Medium").trim(),
    issue: (issue || "").trim(),
    status: "Open",
    createdAt: new Date()
  };

  tickets.push(t);

  console.log("New Ticket:", t);
  res.redirect("/success");
});

/* =========================
   LIST TICKETS
========================= */

app.get("/api/tickets", (req, res) => {
  res.json({ tickets: tickets.slice().reverse() });
});

/* =========================
   KPI API
========================= */

app.get("/api/kpi", (req, res) => {
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const total = tickets.length;
  const open = tickets.filter(t => t.status === "Open").length;
  const critical = tickets.filter(t => t.urgency === "Critical").length;

  const last7 = tickets.filter(
    t => now - new Date(t.createdAt).getTime() <= sevenDaysMs
  ).length;

  const avgPerDay = (last7 / 7).toFixed(1);

  res.json({
    total,
    open,
    critical,
    avgPerDay
  });
});

/* =========================
   CLIENT-SPECIFIC KPI
   Example: /api/kpi/acme
========================= */

app.get("/api/kpi/:company", (req, res) => {
  const company = req.params.company.toLowerCase();

  const companyTickets = tickets.filter(
    t => t.company.toLowerCase() === company
  );

  const total = companyTickets.length;
  const open = companyTickets.filter(t => t.status === "Open").length;
  const critical = companyTickets.filter(
    t => t.urgency === "Critical"
  ).length;

  res.json({
    company,
    total,
    open,
    critical
  });
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log(`CyberBench running at http://localhost:${PORT}`);
});
app.post("/api/chat", async (req, res) => {
  const msg = String(req.body?.message || "").toLowerCase();

  // Simple demo logic. Replace with OpenAI later.
  let reply =
    "I can help with tickets, services, KPIs, and next steps. What are you trying to do?";

  if (msg.includes("ticket")) reply = "To submit a ticket: go to /submit-ticket and fill in company, urgency, and issue details.";
  if (msg.includes("kpi")) reply = "Your KPI page pulls from /api/kpi. Once Supabase is connected, these become real metrics.";
  if (msg.includes("services")) reply = "Core services: Zero Trust Access, SIEM Monitoring, Vulnerability Management, Backups & Recovery.";
  if (msg.includes("portal")) reply = "Client Portal and Consultant Portal are demo pages right now. Next step is adding Supabase Auth + roles.";

  res.json({ reply });
});
app.get("/careers", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "careers.html"))
);
app.get("/blog", (req, res) => res.sendFile(path.join(__dirname, "public", "blog.html")));
app.get("/blog-post-1", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-1.html")));
app.get("/blog-post-2", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-2.html")));
app.get("/blog-post-3", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-3.html")));
app.get("/blog-post-4", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-4.html")));
app.get("/blog-post-5", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-5.html")));
app.get("/blog-post-6", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-6.html")));
app.get("/blog-post-7", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-7.html")));
app.get("/blog-post-8", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-8.html")));
app.get("/blog-post-9", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-9.html")));
app.get("/blog-post-10", (req, res) => res.sendFile(path.join(__dirname, "public", "blog-post-10.html")));