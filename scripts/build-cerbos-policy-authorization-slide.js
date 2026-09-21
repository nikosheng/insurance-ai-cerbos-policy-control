const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.title = "Cerbos policy YAML to authorization boundary";
pptx.subject = "How Cerbos PDP policy becomes MongoDB authorization";
pptx.company = "MongoDB Cerbos MCP";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

const slide = pptx.addSlide();
slide.background = { color: "090B13" };

const c = {
  white: "F8FAFC", muted: "A6B0C2", panel: "151A26", panel2: "101724",
  border: "2A3548", mongo: "00ED64", cerbos: "A78BFA", blue: "4DB7FF",
  amber: "FBBF24", red: "FB7185", greenPanel: "143B2B", purplePanel: "2A1F45",
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
    line: { color, width: 1.5, beginArrowType: "none", endArrowType: "triangle" },
  });
}

// Header
slide.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.333, h: 0.09,
  fill: { color: c.cerbos }, line: { color: c.cerbos, transparency: 100 },
});
tag("POLICY-AS-CODE -> DATA BOUNDARY", 0.48, 0.36, 2.3, "30234E", c.cerbos);
addText("How Cerbos YAML becomes enforced authorization", 0.48, 0.71, 10.5, 0.47, { fontSize: 23, bold: true });
addText("The PDP evaluates the principal against the resource policy, then returns a query plan that the server compiles into MongoDB constraints.", 0.48, 1.21, 12.0, 0.23, { fontSize: 9.5, color: c.muted });

// Main path labels
tag("1  DEFINE", 0.50, 1.67, 0.75, "22324A", c.blue);
tag("2  EVALUATE", 4.02, 1.67, 0.93, "392760", c.cerbos);
tag("3  COMPILE", 7.37, 1.67, 0.84, "1A5137", c.mongo);
tag("4  ENFORCE", 10.44, 1.67, 0.90, "173B4E", c.blue);

// YAML source
box(0.48, 2.03, 3.05, 3.76, c.panel2, "3B4C65");
addText("chat_session_policy.yaml", 0.70, 2.25, 2.3, 0.18, { fontFace: "Courier New", fontSize: 8.5, bold: true, color: c.blue });
addText("rules:\n  - name: agent_own_sessions\n    actions: [search]\n    roles: [insurance_agent]\n    condition:\n      match:\n        all:\n          of:\n          - expr: R.attr.tenant_id ==\n                  P.attr.tenant_id\n          - expr: R.attr.agent_id == P.id", 0.70, 2.61, 2.48, 2.72, { fontFace: "Courier New", fontSize: 7.05, color: "D2DAE8", valign: "top", breakLine: true });
tag("AUTHORIZATION LOGIC", 0.70, 5.41, 1.34, "22324A", c.blue);

// PDP request / principal
box(4.02, 2.03, 2.74, 1.42, c.purplePanel, "6B4DB1");
addText("PDP receives a request", 4.23, 2.25, 2.1, 0.17, { fontSize: 9.6, bold: true });
addText("principal", 4.23, 2.58, 0.75, 0.14, { fontSize: 7, color: c.cerbos, bold: true });
addText("id: agent_1\nrole: insurance_agent\ntenant_id: Tenant_A", 4.98, 2.49, 1.43, 0.54, { fontFace: "Courier New", fontSize: 6.8, color: "E4DAFF", valign: "top", breakLine: true });
addText("resource: chat_session  |  action: search", 4.23, 3.18, 2.16, 0.12, { fontSize: 6.65, color: c.muted });

// PDP response AST
box(4.02, 3.78, 2.74, 2.01, "201A35", "6B4DB1");
tag("PDP RESPONSE: CONDITIONAL PLAN", 4.23, 4.00, 1.75, "392760", c.cerbos);
addText("R.tenant_id = \"Tenant_A\"\nAND\nR.agent_id = \"agent_1\"", 4.23, 4.48, 2.12, 0.65, { fontFace: "Courier New", fontSize: 9, color: "E4DAFF", bold: true, valign: "top", breakLine: true });
addText("No matching rule? Default deny.", 4.23, 5.42, 2.0, 0.13, { fontSize: 7.1, color: "DAB9FF" });

// Compiler
box(7.37, 2.03, 2.53, 3.76, c.greenPanel, "2D8052");
addText("Server-side compiler", 7.59, 2.25, 1.87, 0.17, { fontSize: 9.6, bold: true });
addText("planResponseToMongoFilter()", 7.59, 2.55, 1.96, 0.13, { fontFace: "Courier New", fontSize: 6.6, color: c.mongo });
slide.addShape(pptx.ShapeType.line, { x: 7.59, y: 2.88, w: 2.1, h: 0, line: { color: "397956", width: 0.7 } });
addText("{\n  tenant_id: \"Tenant_A\",\n  agent_id: \"agent_1\"\n}", 7.59, 3.20, 1.95, 0.94, { fontFace: "Courier New", fontSize: 8.2, color: "C7F9D8", valign: "top", breakLine: true });
tag("SECURITY FILTER", 7.59, 4.45, 1.01, "1B5C3A", c.mongo);
addText("Compiled from policy, not supplied by the LLM.", 7.59, 4.91, 1.91, 0.39, { fontSize: 7.2, color: "C3E9D0", valign: "top" });

// Enforce
box(10.44, 2.03, 2.39, 3.76, c.panel, "356B81");
addText("MongoDB Atlas", 10.66, 2.25, 1.49, 0.17, { fontSize: 9.6, bold: true });
addText("$vectorSearch.filter", 10.66, 2.54, 1.69, 0.14, { fontFace: "Courier New", fontSize: 7.1, color: c.blue });
slide.addShape(pptx.ShapeType.line, { x: 10.66, y: 2.88, w: 1.94, h: 0, line: { color: "355877", width: 0.7 } });
tag("ALLOW", 10.66, 3.18, 0.54, "1B5C3A", c.mongo);
addText("Tenant_A / agent_1\nsessions become candidates", 11.29, 3.15, 1.2, 0.43, { fontSize: 6.85, color: "C7F9D8", valign: "top", breakLine: true });
tag("BLOCK", 10.66, 3.86, 0.54, "572332", c.red);
addText("Every other tenant\nor agent is excluded", 11.29, 3.83, 1.2, 0.43, { fontSize: 6.85, color: "F8B4C1", valign: "top", breakLine: true });
addText("Authorization is enforced before semantic ranking.", 10.66, 4.86, 1.86, 0.37, { fontSize: 7.2, color: c.muted, valign: "top" });

arrow(3.57, 3.82, 3.94, 3.82, c.blue);
arrow(6.80, 3.82, 7.29, 3.82, c.cerbos);
arrow(9.95, 3.82, 10.36, 3.82, c.mongo);

// Role variation comparison
box(0.48, 6.16, 12.35, 0.79, "101C19", "285844");
addText("Same YAML resource, different principal", 0.70, 6.34, 2.15, 0.16, { fontSize: 8.2, color: c.muted, bold: true });
tag("INSURANCE AGENT", 3.09, 6.26, 1.12, "22324A", c.blue);
addText('{ tenant_id: "Tenant_A", agent_id: "agent_1" }', 4.31, 6.33, 2.81, 0.15, { fontFace: "Courier New", fontSize: 7.3, color: "C7F9D8" });
tag("TENANT ADMIN", 7.40, 6.26, 0.98, "392760", c.cerbos);
addText('{ tenant_id: "Tenant_A" }', 8.48, 6.33, 1.81, 0.15, { fontFace: "Courier New", fontSize: 7.3, color: "C7F9D8" });
addText("Policy role decides the returned boundary.", 10.51, 6.33, 1.86, 0.15, { fontSize: 7.1, color: c.muted, align: "right" });

slide.addShape(pptx.ShapeType.roundRect, {
  x: 0.48, y: 7.12, w: 12.35, h: 0.2, rectRadius: 0.03,
  fill: { color: c.cerbos }, line: { color: c.cerbos, transparency: 100 },
});
addText("Policy changes propagate from Cerbos YAML to the data boundary without hard-coded role checks in the application.", 0.64, 7.10, 12.0, 0.16, { fontSize: 7.8, color: "FFFFFF", bold: true, align: "center" });

pptx.writeFile({ fileName: "deliverables/cerbos-policy-to-authorization.pptx" });
