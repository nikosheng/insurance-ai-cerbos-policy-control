const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.title = "Why Atlas fits chat memory in this application";
pptx.subject = "Concrete chat-memory retrieval example and database tradeoff";
pptx.company = "MongoDB Cerbos MCP";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

const slide = pptx.addSlide();
slide.background = { color: "F7F6F2" };

const c = {
  ink: "17202B", body: "405063", muted: "657386", hairline: "D9DEE5",
  green: "00684A", greenPale: "E4F4EC", greenMid: "B7DCCB",
  blue: "266AA8", bluePale: "E8F1FA", violet: "6846A5", violetPale: "F0ECF8",
  amber: "A96500", amberPale: "FFF2D8", red: "A8404B", redPale: "FBECEF", white: "FFFFFF",
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
    x, y, w, h, rectRadius: 0.06,
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

function arrow(x1, y1, x2, y2, color) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 1.4, beginArrowType: "none", endArrowType: "triangle" },
  });
}

// Header
slide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.333, h: 0.1,
  fill: { color: c.green }, line: { color: c.green, transparency: 100 },
});
pill("A CONCRETE APP EXAMPLE", 0.48, 0.36, 1.52, c.greenPale, c.green);
addText("Why Atlas fits chat memory in this application", 0.48, 0.73, 10.8, 0.42, { fontSize: 22.5, bold: true });
addText("The point is not that MongoDB wins every database decision. It is that this app already treats a customer conversation as one evolving document, then retrieves it by meaning.", 0.48, 1.20, 12.15, 0.24, { fontSize: 9.25, color: c.body });

// Story intro
addText("A small example", 0.48, 1.72, 1.5, 0.17, { fontSize: 10.2, bold: true, color: c.green });
addText("Sarah finishes a call with Alice. The app saves one memory record, not a separate 'chat row' and 'vector row'.", 1.70, 1.72, 9.9, 0.17, { fontSize: 8.4, color: c.muted });

// Saved session document
box(0.48, 2.08, 4.18, 3.33, c.white, c.greenMid);
pill("AFTER THE SESSION ENDS", 0.72, 2.31, 1.46, c.greenPale, c.green);
addText("chat_sessions / one document", 0.72, 2.68, 2.44, 0.18, { fontSize: 10.5, bold: true });
addText("{\n  customer_name: \"Alice Johnson\",\n  tenant_id: \"Tenant_A\",\n  agent_id: \"agent_1\",\n  summary: \"Renewal call; Alice asked for a\n            revised quote.\",\n  follow_up_actions: [\"Send quote by Monday\"],\n  embedding: BinData(...)\n}", 0.72, 3.10, 3.57, 1.74, { fontFace: "Courier New", fontSize: 6.8, color: c.body, valign: "top", breakLine: true });
addText("The embedding represents the summary and action, while the fields still describe who may retrieve it.", 0.72, 5.01, 3.50, 0.20, { fontSize: 7.1, color: c.muted, valign: "top" });

// New question
box(5.19, 2.08, 2.78, 1.37, c.bluePale, "B7D0E7");
pill("NEXT WEEK", 5.41, 2.31, 0.78, "D7E8F7", c.blue);
addText('Sarah asks: "Did I promise Alice\na revised quote?"', 5.41, 2.72, 2.12, 0.38, { fontSize: 10.2, bold: true, valign: "top", breakLine: true });

// Query
box(5.19, 3.76, 2.78, 1.65, c.violetPale, "D5C9EA");
pill("ONE ATLAS QUERY", 5.41, 3.99, 1.03, "E3DAF4", c.violet);
addText("$vectorSearch", 5.41, 4.37, 1.34, 0.16, { fontFace: "Courier New", fontSize: 9.1, color: c.violet, bold: true });
addText('filter: { tenant_id: "Tenant_A",\n          agent_id: "agent_1" }', 5.41, 4.69, 2.08, 0.34, { fontFace: "Courier New", fontSize: 6.1, color: c.body, valign: "top", breakLine: true });

// Result
box(8.50, 2.08, 4.33, 3.33, c.greenPale, c.greenMid);
pill("WHAT COMES BACK", 8.74, 2.31, 1.07, "D0EBDD", c.green);
addText("The one session Sarah needs", 8.74, 2.68, 2.42, 0.18, { fontSize: 10.5, bold: true });
addText("Alice Johnson  |  relevance: 0.93", 8.74, 3.10, 2.74, 0.15, { fontSize: 7.4, bold: true, color: c.green });
slide.addShape(pptx.ShapeType.line, { x: 8.74, y: 3.42, w: 3.62, h: 0, line: { color: c.greenMid, width: 0.75 } });
addText("Summary", 8.74, 3.66, 0.61, 0.13, { fontSize: 7.3, color: c.muted, bold: true });
addText("Renewal call; Alice asked for a revised quote.", 9.49, 3.63, 2.73, 0.16, { fontSize: 7.8, color: c.ink });
addText("Open action", 8.74, 4.10, 0.76, 0.13, { fontSize: 7.3, color: c.muted, bold: true });
addText("Send quote by Monday", 9.68, 4.07, 2.05, 0.16, { fontSize: 7.8, color: c.ink, bold: true });
addText("The agent receives useful context, not Alice's entire transcript or anyone else's session.", 8.74, 4.68, 3.46, 0.21, { fontSize: 7.2, color: c.green, bold: true, valign: "top" });

arrow(4.71, 3.74, 5.08, 3.74, c.blue);
arrow(8.00, 3.74, 8.39, 3.74, c.violet);

// Decision block
addText("Why this was convenient with Atlas", 0.48, 5.90, 2.85, 0.18, { fontSize: 10.4, bold: true });
box(0.48, 6.21, 7.82, 0.71, c.white, c.hairline);
pill("IN THIS APP", 0.70, 6.43, 0.70, c.greenPale, c.green);
addText("Write the session once. Keep the embedding beside the metadata. Use one aggregation pipeline to pre-filter and rank the same records.", 1.62, 6.40, 6.34, 0.17, { fontSize: 8.25, color: c.body, bold: true });

box(8.58, 5.90, 4.25, 1.02, c.amberPale, "F0D29B");
pill("FAIR TRADEOFF", 8.80, 6.12, 0.88, "FFE6B7", c.amber);
addText("PostgreSQL + pgvector can do this too. Prefer it when relational joins, strict constraints, or SQL analytics are the center of the design.", 8.80, 6.43, 3.61, 0.30, { fontSize: 7.35, color: "704400", valign: "top" });

addText("For this app, Atlas is the simpler fit because session memory is document-shaped and semantic retrieval is a primary access path.", 0.48, 7.16, 12.35, 0.15, { fontSize: 8.2, bold: true, color: c.green, align: "center" });

pptx.writeFile({ fileName: "deliverables/mongodb-atlas-vs-rdbms-chat-memory.pptx" });
