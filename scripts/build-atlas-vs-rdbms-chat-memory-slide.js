const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.title = "Why MongoDB Atlas is a strong fit for chat memory";
pptx.subject = "MongoDB Atlas compared with relational databases for chat history and embeddings";
pptx.company = "MongoDB Cerbos MCP";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

const slide = pptx.addSlide();
slide.background = { color: "090B13" };

const c = {
  white: "F8FAFC", muted: "A6B0C2", panel: "151A26", panel2: "101724", border: "2A3548",
  mongo: "00ED64", green: "143B2B", blue: "4DB7FF", bluePanel: "16283C",
  purple: "A78BFA", purplePanel: "2A1F45", amber: "FBBF24", amberPanel: "332A16",
  red: "FB7185", redPanel: "2D1B24", teal: "2DD4BF",
};

function addText(value, x, y, w, h, options = {}) {
  slide.addText(value, {
    x, y, w, h, margin: 0, fit: "shrink", valign: "mid",
    fontFace: options.fontFace || "Aptos", fontSize: options.fontSize || 10,
    color: options.color || c.white, bold: options.bold || false,
    align: options.align || "left", ...options,
  });
}

function box(x, y, w, h, fill, line = c.border) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: fill }, line: { color: line, width: 0.8 },
  });
}

function tag(label, x, y, w, fill, color = c.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.25, rectRadius: 0.04,
    fill: { color: fill }, line: { color: fill, transparency: 100 },
  });
  addText(label, x, y + 0.01, w, 0.2, { fontSize: 6.4, bold: true, color, align: "center" });
}

function arrow(x1, y1, x2, y2, color) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 1.4, beginArrowType: "none", endArrowType: "triangle" },
  });
}

slide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.333, h: 0.09,
  fill: { color: c.mongo }, line: { color: c.mongo, transparency: 100 },
});
tag("ARCHITECTURE DECISION", 0.48, 0.36, 1.48, "153126", c.mongo);
addText("Why MongoDB Atlas is a strong fit for chat history + embeddings", 0.48, 0.71, 11.9, 0.47, { fontSize: 22.3, bold: true });
addText("For this document-centric, retrieval-heavy workload, Atlas can keep operational session data and semantic memory in one governed platform. It is not a blanket replacement for every RDBMS workload.", 0.48, 1.21, 12.2, 0.25, { fontSize: 9.2, color: c.muted });

// Three Atlas strengths
tag("WHY ATLAS FITS THIS WORKLOAD", 0.48, 1.68, 1.89, "1A5137", c.mongo);

box(0.48, 2.03, 3.82, 2.13, c.panel2, "3D5877");
tag("1  DOCUMENT-NATIVE MEMORY", 0.70, 2.25, 1.36, "22324A", c.blue);
addText("One session = one evolving record", 0.70, 2.64, 2.73, 0.18, { fontSize: 10.1, bold: true });
addText("chat_sessions", 0.70, 2.95, 1.04, 0.13, { fontFace: "Courier New", fontSize: 7.3, color: c.blue });
addText("summary, actions, transcript, timestamps,\ncustomer metadata, and embedding live together.", 0.70, 3.21, 3.00, 0.36, { fontSize: 7.7, color: c.muted, valign: "top", breakLine: true });
addText("Useful when conversation fields evolve frequently.", 0.70, 3.80, 3.00, 0.14, { fontSize: 7.1, color: "B8DFFF" });

box(4.75, 2.03, 3.82, 2.13, c.green, "2D8052");
tag("2  FILTERED VECTOR RETRIEVAL", 4.97, 2.25, 1.52, "1B5C3A", c.mongo);
addText("One retrieval path", 4.97, 2.64, 1.84, 0.18, { fontSize: 10.1, bold: true });
addText("$vectorSearch + metadata filter", 4.97, 2.95, 2.65, 0.13, { fontFace: "Courier New", fontSize: 6.9, color: "C7F9D8" });
addText("Semantic ranking and tenant / agent / customer\nscoping happen against the same session record.", 4.97, 3.21, 3.09, 0.36, { fontSize: 7.7, color: "D2F8DD", valign: "top", breakLine: true });
addText("Fewer data hops in the retrieval path.", 4.97, 3.80, 2.90, 0.14, { fontSize: 7.1, color: "B7F4CA" });

box(9.01, 2.03, 3.82, 2.13, c.purplePanel, "6B4DB1");
tag("3  OPERATE AS ONE PLATFORM", 9.23, 2.25, 1.48, "392760", c.purple);
addText("Less integration surface", 9.23, 2.64, 2.13, 0.18, { fontSize: 10.1, bold: true });
addText("application data + vector index", 9.23, 2.95, 2.48, 0.13, { fontFace: "Courier New", fontSize: 6.9, color: "E4DAFF" });
addText("One data model, query API, deployment surface,\nand access-control integration for this use case.", 9.23, 3.21, 3.03, 0.36, { fontSize: 7.7, color: "E5DEFF", valign: "top", breakLine: true });
addText("Especially compelling if MongoDB already holds the app data.", 9.23, 3.80, 3.08, 0.14, { fontSize: 6.9, color: "DAB9FF" });

arrow(4.34, 3.10, 4.65, 3.10, c.blue);
arrow(8.61, 3.10, 8.91, 3.10, c.mongo);

// Comparison table
tag("DECISION GUIDE", 0.48, 4.55, 1.00, "332A16", c.amber);
box(0.48, 4.89, 12.35, 1.48, c.panel, "3B4658");

// Column dividers
slide.addShape(pptx.ShapeType.line, { x: 3.28, y: 5.08, w: 0, h: 1.10, line: { color: "344054", width: 0.7 } });
slide.addShape(pptx.ShapeType.line, { x: 8.14, y: 5.08, w: 0, h: 1.10, line: { color: "344054", width: 0.7 } });
addText("Decision point", 0.70, 5.13, 1.62, 0.15, { fontSize: 7.5, bold: true, color: c.muted });
addText("Atlas is usually the stronger fit when...", 3.52, 5.13, 3.76, 0.15, { fontSize: 7.5, bold: true, color: c.mongo });
addText("An RDBMS may be the stronger fit when...", 8.38, 5.13, 3.82, 0.15, { fontSize: 7.5, bold: true, color: c.amber });

addText("Data shape", 0.70, 5.48, 1.22, 0.14, { fontSize: 7.4, bold: true });
addText("session records are nested, heterogeneous, and evolve as the product learns", 3.52, 5.44, 4.10, 0.24, { fontSize: 7.0, color: "C7F9D8", valign: "top" });
addText("the model is stable, highly normalized, and governed by strict relational constraints", 8.38, 5.44, 4.02, 0.24, { fontSize: 7.0, color: "FFE4A6", valign: "top" });

addText("Retrieval", 0.70, 5.83, 1.22, 0.14, { fontSize: 7.4, bold: true });
addText("the primary question is semantic recall with document metadata filters", 3.52, 5.79, 4.10, 0.24, { fontSize: 7.0, color: "C7F9D8", valign: "top" });
addText("complex SQL joins, reporting, and transactional analytics are the dominant access paths", 8.38, 5.79, 4.02, 0.24, { fontSize: 7.0, color: "FFE4A6", valign: "top" });

// Bottom conclusion
box(0.48, 6.66, 12.35, 0.46, "173424", "2D8052");
addText("Recommendation for this app: Atlas keeps chat memory, embeddings, and Cerbos-derived vector pre-filters together. PostgreSQL + pgvector remains a valid alternative, not an inferior one, when relational needs lead the design.", 0.70, 6.79, 11.9, 0.15, { fontSize: 8.0, bold: true, color: "D4FFE1", align: "center" });

pptx.writeFile({ fileName: "deliverables/mongodb-atlas-vs-rdbms-chat-memory.pptx" });
