const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.company = "MongoDB Cerbos MCP";
pptx.subject = "Cerbos-authorized customer service memory retrieval";
pptx.title = "Authorized customer memory, blocked by policy";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

const slide = pptx.addSlide();
slide.background = { color: "090B13" };

const c = {
  white: "F8FAFC", muted: "A6B0C2", panel: "151A26", panel2: "101724",
  border: "2A3548", mongo: "00ED64", cerbos: "A78BFA", blue: "4DB7FF",
  red: "FB7185", greenText: "C7F9D8", purpleText: "E4DAFF",
};

function text(value, x, y, w, h, options = {}) {
  slide.addText(value, {
    x, y, w, h, margin: 0, fit: "shrink", valign: "mid",
    fontFace: "Aptos", fontSize: 10, color: c.white,
    ...options,
  });
}

function box(x, y, w, h, fill, line = c.border) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.07,
    fill: { color: fill }, line: { color: line, width: 0.8 },
  });
}

function tag(label, x, y, w, fill, color = c.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.25, rectRadius: 0.04,
    fill: { color: fill }, line: { color: fill, transparency: 100 },
  });
  text(label, x, y + 0.015, w, 0.19, {
    fontSize: 6.35, bold: true, color, align: "center",
  });
}

function arrow(x1, y1, x2, y2, color) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 1.45, beginArrowType: "none", endArrowType: "triangle" },
  });
}

// Header
slide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.333, h: 0.09,
  fill: { color: c.mongo }, line: { color: c.mongo, transparency: 100 },
});
tag("ZERO-TRUST CUSTOMER MEMORY", 0.48, 0.35, 2.2, "173424", c.mongo);
text("The right agent gets the answer. Everyone else gets nothing.", 0.48, 0.70, 11.8, 0.47, {
  fontSize: 23, bold: true,
});
text("Cerbos PDP turns agent identity into an Atlas Vector Search filter before customer-service summaries and actions are ranked.", 0.48, 1.21, 12.0, 0.22, {
  fontSize: 9.35, color: c.muted,
});

// Memory creation lane
tag("1  CREATE CUSTOMER MEMORY", 0.48, 1.66, 1.64, "22324A", c.blue);
box(0.48, 2.00, 3.00, 1.25, c.panel2, "3B4C65");
text("Alice Johnson calls customer service", 0.68, 2.18, 2.53, 0.18, { fontSize: 10, bold: true });
text("Topic: renewal documents and policy expiry", 0.68, 2.47, 2.49, 0.14, { fontSize: 7.7, color: c.muted });
tag("CUSTOMER CHAT", 0.68, 2.78, 0.95, "173B4E", c.blue);

box(3.82, 2.00, 3.16, 1.25, "182438", "48658A");
text("LLM summary + action extraction", 4.02, 2.18, 2.55, 0.18, { fontSize: 10, bold: true });
text("Summary: Alice needs her renewal packet.", 4.02, 2.46, 2.62, 0.14, { fontSize: 7.45, color: "D2DAE8" });
text("Action: Send renewal quote by Friday.", 4.02, 2.68, 2.65, 0.14, { fontSize: 7.45, color: c.greenText });

box(7.32, 2.00, 2.39, 1.25, "133327", "2D8C5A");
text("Voyage embedding", 7.52, 2.18, 1.77, 0.18, { fontSize: 10, bold: true });
text("summary + actions", 7.52, 2.47, 1.72, 0.14, { fontSize: 7.55, color: c.greenText });
text("1024 dimensions", 7.52, 2.68, 1.66, 0.14, { fontSize: 7.55, color: c.muted });

box(10.05, 2.00, 2.78, 1.25, c.panel, "356B81");
text("MongoDB Atlas", 10.25, 2.18, 1.64, 0.18, { fontSize: 10, bold: true });
text("chat_sessions document", 10.25, 2.47, 1.89, 0.14, { fontSize: 7.55, color: c.blue });
text("tenant_A | agent_1 | Alice", 10.25, 2.68, 2.13, 0.14, { fontSize: 7.25, color: c.muted });

arrow(3.52, 2.62, 3.75, 2.62, c.blue);
arrow(7.02, 2.62, 7.25, 2.62, c.mongo);
arrow(9.75, 2.62, 9.98, 2.62, c.mongo);

// Divider and query label
slide.addShape(pptx.ShapeType.line, { x: 0.48, y: 3.58, w: 12.35, h: 0, line: { color: "29364B", width: 0.75 } });
tag("2  RETRIEVE PENDING ACTIONS", 0.48, 3.77, 1.75, "392760", c.cerbos);
text('Agent asks: "What pending actions do I have for Alice Johnson?"', 2.45, 3.80, 6.1, 0.17, { fontSize: 9.1, bold: true });
text("Same semantic query. Different identity. Different authorized result.", 9.06, 3.81, 3.77, 0.15, { fontSize: 7.7, color: c.muted, align: "right" });

// Allowed lane: Sarah
box(0.48, 4.20, 6.03, 2.43, "10271F", "26734F");
tag("ALLOW: SARAH CHEN", 0.72, 4.43, 1.16, "185C3A", c.mongo);
text("Sarah Chen", 0.72, 4.78, 1.54, 0.19, { fontSize: 11, bold: true });
text("insurance_agent  |  Tenant_A  |  agent_1", 2.15, 4.80, 2.95, 0.15, { fontSize: 7.6, color: c.muted });

box(0.72, 5.18, 2.45, 0.91, "201A35", "6B4DB1");
tag("CERBOS PDP", 0.88, 5.33, 0.82, "392760", c.cerbos);
text('{ tenant_id: "Tenant_A",\n  agent_id: "agent_1" }', 0.88, 5.61, 1.96, 0.29, {
  fontFace: "Courier New", fontSize: 7.35, color: c.purpleText, valign: "top", breakLine: true,
});

box(3.43, 5.18, 2.82, 0.91, "143B2B", "2D8052");
tag("ATLAS $VECTORSEARCH", 3.60, 5.33, 1.22, "1A5137", c.mongo);
text("Alice session is a candidate", 3.60, 5.62, 2.15, 0.14, { fontSize: 7.8, bold: true, color: c.greenText });
text("then ranked for relevance", 3.60, 5.83, 1.86, 0.13, { fontSize: 7.25, color: c.muted });
arrow(3.20, 5.63, 3.36, 5.63, c.cerbos);

box(0.72, 6.22, 5.53, 0.22, "173424", "2D8052");
text("RETURNED: Alice Johnson | Send renewal quote by Friday", 0.92, 6.25, 5.05, 0.13, {
  fontSize: 7.65, bold: true, color: c.greenText,
});

// Denied lane: Marcus
box(6.80, 4.20, 6.03, 2.43, "29171F", "6B3042");
tag("BLOCK: MARCUS RIVERA", 7.04, 4.43, 1.30, "572332", c.red);
text("Marcus Rivera", 7.04, 4.78, 1.66, 0.19, { fontSize: 11, bold: true });
text("insurance_agent  |  Tenant_A  |  agent_2", 8.56, 4.80, 2.96, 0.15, { fontSize: 7.6, color: c.muted });

box(7.04, 5.18, 2.45, 0.91, "201A35", "6B4DB1");
tag("CERBOS PDP", 7.20, 5.33, 0.82, "392760", c.cerbos);
text('{ tenant_id: "Tenant_A",\n  agent_id: "agent_2" }', 7.20, 5.61, 1.96, 0.29, {
  fontFace: "Courier New", fontSize: 7.35, color: c.purpleText, valign: "top", breakLine: true,
});

box(9.75, 5.18, 2.82, 0.91, "311B24", "7A3547");
tag("EXCLUDED BEFORE SCORING", 9.92, 5.33, 1.45, "572332", c.red);
text("Alice belongs to agent_1", 9.92, 5.62, 1.91, 0.14, { fontSize: 7.8, bold: true, color: "F8B4C1" });
text("0 results returned", 9.92, 5.83, 1.47, 0.13, { fontSize: 7.25, color: c.muted });
arrow(9.52, 5.63, 9.68, 5.63, c.red);

box(7.04, 6.22, 5.53, 0.22, "3A1E28", "7A3547");
text("BLOCKED: Alice's summary and actions never enter the result set", 7.24, 6.25, 5.04, 0.13, {
  fontSize: 7.65, bold: true, color: "F8B4C1",
});

// Footer
box(0.48, 6.88, 12.35, 0.35, "101C19", "285844");
text("Security outcome: Cerbos PDP governs the Atlas candidate set. The LLM can ask for Alice, but only Sarah's policy-derived filter can retrieve Alice's customer-service memory.", 0.74, 6.98, 11.84, 0.13, {
  fontSize: 7.75, color: "D4FFE1", bold: true, align: "center",
});

pptx.writeFile({ fileName: "deliverables/customer-memory-cerbos-authorization.pptx" });
