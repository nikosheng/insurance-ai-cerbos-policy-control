const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.title = "MongoDB Atlas versus RDBMS for chat memory";
pptx.subject = "Direct comparison for vector-backed chat session memory";
pptx.company = "MongoDB Cerbos MCP";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

const slide = pptx.addSlide();
slide.background = { color: "F7F6F2" };

const c = {
  ink: "17202B", body: "405063", muted: "657386", hairline: "D9DEE5", white: "FFFFFF",
  green: "00684A", greenPale: "E4F4EC", greenLine: "AFD9C4", blue: "266AA8",
  bluePale: "E8F1FA", amber: "A96500", amberPale: "FFF2D8", violet: "6846A5", violetPale: "F0ECF8",
};

function addText(value, x, y, w, h, options = {}) {
  slide.addText(value, {
    x, y, w, h, margin: 0, fit: "shrink", valign: "mid",
    fontFace: options.fontFace || "Aptos", fontSize: options.fontSize || 10,
    color: options.color || c.ink, bold: options.bold || false,
    align: options.align || "left", ...options,
  });
}

function box(x, y, w, h, fill, line = c.hairline) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.05,
    fill: { color: fill }, line: { color: line, width: 0.75 },
  });
}

function pill(label, x, y, w, fill, color) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.25, rectRadius: 0.04,
    fill: { color: fill }, line: { color: fill, transparency: 100 },
  });
  addText(label, x, y + 0.01, w, 0.19, { fontSize: 6.4, bold: true, color, align: "center" });
}

slide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.333, h: 0.1,
  fill: { color: c.green }, line: { color: c.green, transparency: 100 },
});
pill("DECISION SLIDE", 0.48, 0.36, 0.94, c.greenPale, c.green);
addText("MongoDB Atlas vs. RDBMS for chat memory", 0.48, 0.72, 10.0, 0.42, { fontSize: 22.5, bold: true });
addText("Same requirement: Sarah needs to recall that she promised Alice a revised renewal quote, without searching every past transcript.", 0.48, 1.20, 12.1, 0.22, { fontSize: 9.2, color: c.body });

// Concrete input / output strip
box(0.48, 1.69, 12.35, 0.56, c.bluePale, "C6DDED");
addText("The workload", 0.70, 1.88, 0.85, 0.13, { fontSize: 7.3, bold: true, color: c.blue });
addText('Question: "Did I promise Alice a revised quote?"', 1.69, 1.84, 2.85, 0.17, { fontSize: 8.4, bold: true });
addText("Required result: Alice's matching session summary + open action, limited to Sarah's Tenant_A / agent_1 scope.", 4.89, 1.84, 7.35, 0.17, { fontSize: 8.1, color: c.body });

// Table header
box(0.48, 2.57, 12.35, 0.47, c.ink, c.ink);
addText("Decision point", 0.72, 2.72, 2.10, 0.14, { fontSize: 7.7, bold: true, color: c.white });
addText("MongoDB Atlas", 3.42, 2.72, 3.48, 0.14, { fontSize: 7.7, bold: true, color: "BBF3D2" });
addText("RDBMS + pgvector", 8.08, 2.72, 3.43, 0.14, { fontSize: 7.7, bold: true, color: "D6E9FA" });

const rows = [
  {
    label: "How the memory is stored",
    mongo: "One chat_sessions document: summary, action list, metadata, and embedding sit together.",
    rdbms: "Usually a session table plus vector column or related vector table; JSONB can carry flexible fields.",
  },
  {
    label: "How Sarah retrieves it",
    mongo: "$vectorSearch with tenant_id + agent_id filter, then project summary and actions.",
    rdbms: "WHERE tenant_id / agent_id, then order by vector distance; pgvector supports this pattern.",
  },
  {
    label: "When the session shape changes",
    mongo: "Adding source, new action fields, or new summary data is natural for an evolving document.",
    rdbms: "A stable relational model is excellent; frequent optional fields require schema or JSONB choices.",
  },
  {
    label: "Where Atlas has an edge here",
    mongo: "The app already uses MongoDB: no separate operational store or vector sync path is needed.",
    rdbms: "If the app already runs on PostgreSQL, pgvector may be the lower-friction choice instead.",
  },
];

let y = 3.04;
for (let i = 0; i < rows.length; i += 1) {
  const row = rows[i];
  const fill = i % 2 === 0 ? c.white : "FBFAF7";
  slide.addShape(pptx.ShapeType.rect, { x: 0.48, y, w: 12.35, h: 0.72, fill: { color: fill }, line: { color: c.hairline, width: 0.55 } });
  slide.addShape(pptx.ShapeType.line, { x: 3.12, y: y + 0.05, w: 0, h: 0.62, line: { color: c.hairline, width: 0.55 } });
  slide.addShape(pptx.ShapeType.line, { x: 7.80, y: y + 0.05, w: 0, h: 0.62, line: { color: c.hairline, width: 0.55 } });
  addText(row.label, 0.72, y + 0.19, 2.04, 0.30, { fontSize: 8.1, bold: true, valign: "top" });
  addText(row.mongo, 3.38, y + 0.16, 4.06, 0.36, { fontSize: 7.25, color: c.body, valign: "top" });
  addText(row.rdbms, 8.06, y + 0.16, 4.20, 0.36, { fontSize: 7.25, color: c.body, valign: "top" });
  y += 0.72;
}

// Direct recommendation
box(0.48, 6.20, 8.00, 0.84, c.greenPale, c.greenLine);
pill("WHY CHOOSE MONGODB HERE", 0.70, 6.43, 1.46, "D1EBDE", c.green);
addText("Chat memory is document-shaped, semantic retrieval is a primary path, and the application already stores operational data in MongoDB. Atlas keeps the data and vector retrieval together.", 2.42, 6.37, 5.70, 0.30, { fontSize: 7.65, color: c.ink, bold: true, valign: "top" });

box(8.78, 6.20, 4.05, 0.84, c.amberPale, "F0D29B");
pill("DON'T CHOOSE IT WHEN", 9.00, 6.43, 1.29, "FFE6B7", c.amber);
addText("Complex joins, strict relational modeling, and SQL reporting are the dominant needs. In that case, an RDBMS can be the better home.", 9.00, 6.68, 3.46, 0.18, { fontSize: 6.95, color: "704400", valign: "top" });

addText("The decision is driven by the shape of the data and the primary query path, not by vector search alone.", 0.48, 7.20, 12.35, 0.12, { fontSize: 7.8, color: c.muted, align: "center", italic: true });

pptx.writeFile({ fileName: "deliverables/mongodb-vs-rdbms-chat-memory-comparison.pptx" });
