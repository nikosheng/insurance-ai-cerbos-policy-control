const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.subject = "Cerbos pre-filtered MongoDB Atlas Vector Search";
pptx.title = "Cerbos pre-filtered MongoDB Atlas Vector Search";
pptx.company = "MongoDB Cerbos MCP";
pptx.lang = "en-US";
pptx.theme = {
  headFontFace: "Aptos Display",
  bodyFontFace: "Aptos",
  lang: "en-US",
};
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";

const slide = pptx.addSlide();
slide.background = { color: "090B13" };
slide.addShape(pptx.ShapeType.rect, {
  x: 0,
  y: 0,
  w: 13.333,
  h: 0.09,
  fill: { color: "00ED64" },
  line: { color: "00ED64", transparency: 100 },
});

const colors = {
  white: "F8FAFC",
  muted: "A6B0C2",
  slate: "151A26",
  slate2: "1C2433",
  border: "2A3548",
  mongo: "00ED64",
  cerbos: "A78BFA",
  blue: "4DB7FF",
  amber: "FBBF24",
  danger: "FB7185",
  code: "0D1320",
};

function text(textValue, x, y, w, h, options = {}) {
  slide.addText(textValue, {
    x, y, w, h,
    margin: 0,
    breakLine: false,
    fontFace: options.fontFace || "Aptos",
    fontSize: options.fontSize || 10,
    color: options.color || colors.white,
    bold: options.bold || false,
    align: options.align || "left",
    valign: options.valign || "mid",
    fit: "shrink",
    ...options,
  });
}

function box(x, y, w, h, fill, line = colors.border, radius = true) {
  slide.addShape(radius ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
    x, y, w, h,
    rectRadius: radius ? 0.08 : undefined,
    fill: { color: fill },
    line: { color: line, width: 0.8 },
  });
}

function tag(label, x, y, w, fill, color) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.27,
    rectRadius: 0.04,
    fill: { color: fill },
    line: { color: fill, transparency: 100 },
  });
  text(label, x, y + 0.01, w, 0.22, { fontSize: 6.7, bold: true, color, align: "center" });
}

function arrow(x1, y1, x2, y2, color) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 1.5, beginArrowType: "none", endArrowType: "triangle" },
  });
}

// Header
tag("ZERO-TRUST SEMANTIC SEARCH", 0.48, 0.36, 2.24, "153126", colors.mongo);
text("Authorize first. Rank second.", 0.48, 0.71, 7.6, 0.48, { fontSize: 24, bold: true });
text("Cerbos turns identity and policy into an Atlas Vector Search pre-filter, so unauthorized sessions never enter similarity scoring.", 0.48, 1.21, 11.95, 0.28, { fontSize: 9.6, color: colors.muted });

// Input prompt
box(0.48, 1.8, 2.05, 0.78, colors.slate);
tag("1  USER QUESTION", 0.63, 1.95, 0.95, "22324A", colors.blue);
text('"Show me pending follow-up actions"', 0.63, 2.22, 1.73, 0.18, { fontSize: 8.5, bold: true });

// PDP
box(3.1, 1.7, 2.42, 1.0, "201A35", "5B3A9A");
tag("2  CERBOS PDP", 3.27, 1.86, 1.12, "392760", colors.cerbos);
text("Sarah Chen", 3.27, 2.15, 0.87, 0.17, { fontSize: 9.2, bold: true });
text("insurance_agent", 4.15, 2.15, 1.08, 0.17, { fontSize: 7.8, color: colors.muted, align: "right" });
text("Tenant_A  |  agent_1", 3.27, 2.38, 1.94, 0.14, { fontSize: 7.6, color: colors.cerbos });

// Filter
box(6.1, 1.7, 2.52, 1.0, "133327", "2D8C5A");
tag("3  POLICY AS FILTER", 6.27, 1.86, 1.37, "1A5137", colors.mongo);
text('{ tenant_id: "Tenant_A",', 6.27, 2.14, 2.05, 0.17, { fontFace: "Courier New", fontSize: 7.6, color: "B9F6CB" });
text('  agent_id: "agent_1" }', 6.27, 2.36, 2.05, 0.17, { fontFace: "Courier New", fontSize: 7.6, color: "B9F6CB" });

// Atlas vector search
box(9.2, 1.7, 3.64, 1.0, colors.slate, "356B81");
tag("4  ATLAS VECTOR SEARCH", 9.37, 1.86, 1.66, "173B4E", colors.blue);
text("Filter inside ANN index scan", 9.37, 2.16, 2.9, 0.18, { fontSize: 9.3, bold: true });
text("only permitted vectors are candidates", 9.37, 2.39, 2.93, 0.14, { fontSize: 7.7, color: colors.muted });

arrow(2.55, 2.19, 3.03, 2.19, colors.blue);
arrow(5.55, 2.19, 6.02, 2.19, colors.cerbos);
arrow(8.65, 2.19, 9.12, 2.19, colors.mongo);

// Index declaration note
box(0.48, 2.98, 12.36, 0.47, "0E1521", "1D2B3E");
text("INDEX REQUIREMENT", 0.68, 3.12, 1.1, 0.11, { fontSize: 6.8, color: colors.amber, bold: true });
text('Atlas index declares  embedding  as vector, and  tenant_id / agent_id  as filter fields. This makes the policy boundary part of candidate retrieval.', 1.91, 3.10, 10.5, 0.14, { fontSize: 7.7, color: colors.muted });

// Bottom sections
text("What Atlas sees", 0.48, 3.73, 3.0, 0.22, { fontSize: 11.5, bold: true });
text("The policy filter is nested in $vectorSearch, not appended after it.", 0.48, 3.98, 5.8, 0.16, { fontSize: 7.9, color: colors.muted });
box(0.48, 4.28, 5.22, 2.1, colors.code, "24344A");

const code = [
  { text: "{ $vectorSearch: {\n", color: colors.white },
  { text: "  index: \"chat_session_embedding_index\",\n", color: "95C8FF" },
  { text: "  path: \"embedding\",\n", color: "95C8FF" },
  { text: "  queryVector: embed(query),\n", color: colors.white },
  { text: "  filter: { tenant_id: \"Tenant_A\",\n", color: colors.mongo },
  { text: "            agent_id: \"agent_1\" },\n", color: colors.mongo },
  { text: "  limit: 3\n", color: colors.white },
  { text: "} }", color: colors.white },
];
let codeY = 4.5;
for (const line of code) {
  text(line.text, 0.75, codeY, 4.7, 0.2, { fontFace: "Courier New", fontSize: 7.6, color: line.color, valign: "top", breakLine: true });
  codeY += line.text.includes("\n") ? 0.23 * (line.text.match(/\n/g) || []).length : 0.23;
}

text("Candidate set and result set", 6.14, 3.73, 4.2, 0.22, { fontSize: 11.5, bold: true });
text("Pre-filtered sessions can be scored. Everything else is unreachable.", 6.14, 3.98, 6.0, 0.16, { fontSize: 7.9, color: colors.muted });

// Rejected rows
box(6.14, 4.28, 2.56, 0.64, "29171F", "6B3042");
tag("EXCLUDED BEFORE SCORING", 6.30, 4.39, 1.44, "572332", colors.danger);
text("Tenant_B / agent_3", 6.30, 4.68, 1.95, 0.12, { fontSize: 7.6, color: "F8B4C1" });
text("x", 8.36, 4.49, 0.16, 0.15, { fontSize: 12, color: colors.danger, bold: true, align: "center" });

box(6.14, 5.04, 2.56, 0.64, "29171F", "6B3042");
tag("EXCLUDED BEFORE SCORING", 6.30, 5.15, 1.44, "572332", colors.danger);
text("Tenant_A / agent_2", 6.30, 5.44, 1.95, 0.12, { fontSize: 7.6, color: "F8B4C1" });
text("x", 8.36, 5.25, 0.16, 0.15, { fontSize: 12, color: colors.danger, bold: true, align: "center" });

arrow(8.84, 5.0, 9.17, 5.0, colors.mongo);

// Returned ranked cards
box(9.34, 4.28, 3.5, 1.4, "10271F", "26734F");
tag("SCORED + RETURNED", 9.52, 4.42, 1.15, "185C3A", colors.mongo);
text("1. Alice Johnson", 9.52, 4.74, 1.52, 0.16, { fontSize: 8.9, bold: true });
text("Renewal documents to send", 9.52, 4.99, 2.28, 0.14, { fontSize: 7.5, color: colors.muted });
tag("0.94", 12.05, 4.76, 0.52, "1B4C35", "C5FAD9");

box(9.34, 5.84, 3.5, 0.54, "10271F", "26734F");
text("2. Bob Smith", 9.52, 6.00, 1.28, 0.14, { fontSize: 8, bold: true });
text("Call back after inspection", 10.77, 6.00, 1.52, 0.14, { fontSize: 7.3, color: colors.muted });
tag("0.89", 12.05, 5.97, 0.52, "1B4C35", "C5FAD9");

// Footer takeaway
slide.addShape(pptx.ShapeType.roundRect, {
  x: 0.48, y: 6.74, w: 12.36, h: 0.45,
  rectRadius: 0.05,
  fill: { color: "173424" },
  line: { color: "2D8052", width: 0.7 },
});
text("SECURITY OUTCOME", 0.69, 6.89, 1.18, 0.11, { fontSize: 6.9, color: colors.mongo, bold: true });
text("Cerbos constrains the ANN candidate set before relevance ranking. There is no unauthorized result to post-filter or leak.", 2.0, 6.85, 10.2, 0.15, { fontSize: 8.7, bold: true, color: "D4FFE1" });

pptx.writeFile({ fileName: "deliverables/vector-search-cerbos-prefilter.pptx" });
