const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.title = "MongoDB Atlas Vector Search for agent context and long-term memory";
pptx.subject = "Autonomous agent retrieval and chat-session memory";
pptx.company = "MongoDB Cerbos MCP";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Aptos Display", bodyFontFace: "Aptos", lang: "en-US" };

const c = {
  bg: "090B13", white: "F8FAFC", muted: "A6B0C2", panel: "151A26", panel2: "101724",
  border: "2A3548", mongo: "00ED64", cerbos: "A78BFA", blue: "4DB7FF", amber: "FBBF24",
  red: "FB7185", greenPanel: "143B2B", purplePanel: "2A1F45", teal: "2DD4BF",
};

function initSlide(accent) {
  const slide = pptx.addSlide();
  slide.background = { color: c.bg };
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 13.333, h: 0.09,
    fill: { color: accent }, line: { color: accent, transparency: 100 },
  });
  return slide;
}

function addText(slide, value, x, y, w, h, options = {}) {
  slide.addText(value, {
    x, y, w, h, margin: 0, fit: "shrink", valign: "mid",
    fontFace: options.fontFace || "Aptos", fontSize: options.fontSize || 10,
    color: options.color || c.white, bold: options.bold || false,
    align: options.align || "left", ...options,
  });
}

function box(slide, x, y, w, h, fill, line = c.border) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.08,
    fill: { color: fill }, line: { color: line, width: 0.8 },
  });
}

function tag(slide, label, x, y, w, fill, color = c.white) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.25, rectRadius: 0.04,
    fill: { color: fill }, line: { color: fill, transparency: 100 },
  });
  addText(slide, label, x, y + 0.01, w, 0.2, { fontSize: 6.4, bold: true, color, align: "center" });
}

function arrow(slide, x1, y1, x2, y2, color) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width: 1.5, beginArrowType: "none", endArrowType: "triangle" },
  });
}

// Slide 1: autonomous agent working context
{
  const slide = initSlide(c.mongo);
  tag(slide, "AUTONOMOUS AGENT: ACTIVE CONTEXT", 0.48, 0.36, 2.36, "153126", c.mongo);
  addText(slide, "Atlas Vector Search gives the agent the right memory for this turn", 0.48, 0.71, 11.9, 0.48, { fontSize: 22.5, bold: true });
  addText(slide, "Instead of loading all session history, the agent retrieves a small, authorized set of the most relevant follow-up actions into its working window.", 0.48, 1.21, 12.0, 0.23, { fontSize: 9.5, color: c.muted });

  // Prompt / tool trigger
  box(slide, 0.48, 1.77, 2.48, 1.02, c.panel, "355877");
  tag(slide, "CURRENT USER TURN", 0.66, 1.94, 1.05, "22324A", c.blue);
  addText(slide, '"What follow-up actions\nare still pending?"', 0.66, 2.26, 1.95, 0.34, { fontSize: 10.2, bold: true, valign: "top", breakLine: true });
  addText(slide, "Agent selects search_sessions", 0.66, 2.60, 1.8, 0.12, { fontSize: 6.9, color: c.muted });

  // Tool / security / embedding
  box(slide, 3.48, 1.77, 2.62, 1.02, c.purplePanel, "6B4DB1");
  tag(slide, "RETRIEVAL TOOL", 3.66, 1.94, 0.92, "392760", c.cerbos);
  addText(slide, "search_sessions(query)", 3.66, 2.25, 1.96, 0.15, { fontFace: "Courier New", fontSize: 8.2, color: "E4DAFF", bold: true });
  addText(slide, "Cerbos filter + query embedding", 3.66, 2.54, 2.05, 0.12, { fontSize: 6.9, color: "DAB9FF" });

  // Atlas
  box(slide, 6.63, 1.77, 3.16, 1.02, c.greenPanel, "2D8052");
  tag(slide, "MONGODB ATLAS", 6.81, 1.94, 0.95, "1B5C3A", c.mongo);
  addText(slide, "$vectorSearch", 6.81, 2.24, 1.36, 0.16, { fontFace: "Courier New", fontSize: 9.3, color: "C7F9D8", bold: true });
  addText(slide, 'filter: { tenant_id: "Tenant_A", agent_id: "agent_1" }', 6.81, 2.51, 2.64, 0.12, { fontFace: "Courier New", fontSize: 5.95, color: "B7F4CA" });

  // Result / working window
  box(slide, 10.32, 1.77, 2.51, 1.02, "123127", "2D8052");
  tag(slide, "TOP MATCHES", 10.50, 1.94, 0.77, "1B5C3A", c.mongo);
  addText(slide, "summaries + actions", 10.50, 2.24, 1.73, 0.16, { fontSize: 9.2, bold: true });
  addText(slide, "returned as tool result", 10.50, 2.54, 1.7, 0.12, { fontSize: 6.9, color: "C3E9D0" });

  arrow(slide, 3.00, 2.28, 3.39, 2.28, c.blue);
  arrow(slide, 6.14, 2.28, 6.54, 2.28, c.cerbos);
  arrow(slide, 9.83, 2.28, 10.23, 2.28, c.mongo);

  // Large working window below
  box(slide, 0.48, 3.23, 8.04, 3.28, c.panel2, "3D5877");
  tag(slide, "AGENT INTERNAL WORKING WINDOW", 0.70, 3.46, 1.89, "22324A", c.blue);
  addText(slide, "Current prompt", 0.70, 3.87, 1.08, 0.14, { fontSize: 7.3, color: c.muted, bold: true });
  addText(slide, '"What follow-up actions are still pending?"', 1.76, 3.84, 3.05, 0.18, { fontSize: 8.7, bold: true });
  slide.addShape(pptx.ShapeType.line, { x: 0.70, y: 4.18, w: 7.58, h: 0, line: { color: "30405A", width: 0.7 } });
  addText(slide, "Tool result: only relevant authorized session memory", 0.70, 4.39, 3.5, 0.16, { fontSize: 8.2, bold: true, color: c.teal });

  box(slide, 0.70, 4.76, 3.53, 1.10, "143B2B", "2D8052");
  tag(slide, "MATCH 1  SCORE 0.94", 0.86, 4.90, 1.10, "1B5C3A", c.mongo);
  addText(slide, "Alice Johnson", 0.86, 5.22, 1.08, 0.14, { fontSize: 8.8, bold: true });
  addText(slide, "Action: send renewal documents", 0.86, 5.51, 2.67, 0.13, { fontSize: 7.3, color: "C7F9D8" });

  box(slide, 4.46, 4.76, 3.53, 1.10, "143B2B", "2D8052");
  tag(slide, "MATCH 2  SCORE 0.89", 4.62, 4.90, 1.10, "1B5C3A", c.mongo);
  addText(slide, "Bob Smith", 4.62, 5.22, 1.08, 0.14, { fontSize: 8.8, bold: true });
  addText(slide, "Action: call after inspection", 4.62, 5.51, 2.67, 0.13, { fontSize: 7.3, color: "C7F9D8" });
  addText(slide, "The model can now prioritize and respond with the pending work that matters to this question.", 0.70, 6.14, 7.3, 0.16, { fontSize: 7.8, color: c.muted });

  // Contrast panel
  box(slide, 8.88, 3.23, 3.95, 3.28, "1C1723", "64324A");
  tag(slide, "WHY VECTOR SEARCH", 9.10, 3.46, 1.10, "572332", c.red);
  addText(slide, "Not this:", 9.10, 3.91, 0.72, 0.15, { fontSize: 8.4, bold: true, color: "F8B4C1" });
  addText(slide, "Load every past chat\ninto the context window", 9.10, 4.19, 2.0, 0.4, { fontSize: 9.2, bold: true, color: "F7C5CE", valign: "top", breakLine: true });
  slide.addShape(pptx.ShapeType.line, { x: 9.10, y: 4.82, w: 3.28, h: 0, line: { color: "64324A", width: 0.7 } });
  addText(slide, "Instead:", 9.10, 5.05, 0.72, 0.15, { fontSize: 8.4, bold: true, color: c.mongo });
  addText(slide, "Retrieve a small, ranked\nset of useful memories", 9.10, 5.33, 2.55, 0.4, { fontSize: 9.2, bold: true, color: "C7F9D8", valign: "top", breakLine: true });
  addText(slide, "Focused context. Less noise. No cross-scope data.", 9.10, 6.13, 3.02, 0.15, { fontSize: 7.6, color: c.muted });

  box(slide, 0.48, 6.84, 12.35, 0.38, "173424", "2D8052");
  addText(slide, "Atlas turns stored session history into a secure, just-in-time retrieval layer for autonomous agent reasoning.", 0.70, 6.95, 11.9, 0.14, { fontSize: 8.5, bold: true, color: "D4FFE1", align: "center" });
}

// Slide 2: long-term chat memory
{
  const slide = initSlide(c.teal);
  tag(slide, "AGENT MEMORY: LONG-TERM SESSION MEMORY", 0.48, 0.36, 2.65, "12342F", c.teal);
  addText(slide, "Atlas makes chat sessions durable, searchable long-term memory", 0.48, 0.71, 11.9, 0.48, { fontSize: 22.5, bold: true });
  addText(slide, "Each completed conversation is compressed into semantic memory, then selectively recalled when a new chat starts with the same customer.", 0.48, 1.21, 12.0, 0.23, { fontSize: 9.5, color: c.muted });

  // Write path
  tag(slide, "WRITE MEMORY AFTER A SESSION ENDS", 0.48, 1.68, 2.05, "1A5137", c.mongo);
  box(slide, 0.48, 2.03, 2.28, 1.22, c.panel, "355877");
  addText(slide, "1. Conversation ends", 0.68, 2.26, 1.6, 0.17, { fontSize: 9.2, bold: true });
  addText(slide, "Customer-agent transcript", 0.68, 2.58, 1.55, 0.13, { fontSize: 7.3, color: c.muted });
  addText(slide, "not kept in the active window", 0.68, 2.79, 1.68, 0.12, { fontSize: 6.7, color: c.muted });

  box(slide, 3.22, 2.03, 2.58, 1.22, c.purplePanel, "6B4DB1");
  addText(slide, "2. Create memory", 3.42, 2.26, 1.5, 0.17, { fontSize: 9.2, bold: true });
  addText(slide, "AI summarizes the chat\nand extracts follow-up actions", 3.42, 2.58, 1.95, 0.34, { fontSize: 7.5, color: "E4DAFF", valign: "top", breakLine: true });

  box(slide, 6.28, 2.03, 2.32, 1.22, "12342F", "2B827A");
  addText(slide, "3. Embed memory", 6.48, 2.26, 1.43, 0.17, { fontSize: 9.2, bold: true });
  addText(slide, "summary + actions\n-> 1024-dim vector", 6.48, 2.58, 1.52, 0.34, { fontSize: 7.5, color: "C8FAF4", valign: "top", breakLine: true });

  box(slide, 9.08, 2.03, 3.75, 1.22, c.greenPanel, "2D8052");
  addText(slide, "4. Persist in Atlas", 9.28, 2.26, 1.65, 0.17, { fontSize: 9.2, bold: true });
  addText(slide, "chat_sessions: summary, actions, metadata, embedding", 9.28, 2.58, 3.05, 0.13, { fontSize: 6.7, color: "C7F9D8" });
  addText(slide, "Tenant + agent + customer fields scope future recall", 9.28, 2.80, 3.07, 0.12, { fontSize: 6.6, color: "B7F4CA" });

  arrow(slide, 2.80, 2.64, 3.12, 2.64, c.blue);
  arrow(slide, 5.84, 2.64, 6.18, 2.64, c.cerbos);
  arrow(slide, 8.64, 2.64, 8.98, 2.64, c.teal);

  // Separator
  slide.addShape(pptx.ShapeType.line, { x: 0.48, y: 3.67, w: 12.35, h: 0, line: { color: "2A3548", width: 0.8 } });

  // Recall path
  tag(slide, "RECALL MEMORY ON THE FIRST TURN OF A NEW CHAT", 0.48, 3.96, 2.75, "22324A", c.blue);
  box(slide, 0.48, 4.31, 2.38, 1.42, c.panel, "355877");
  addText(slide, "New customer message", 0.68, 4.55, 1.48, 0.16, { fontSize: 9.1, bold: true });
  addText(slide, '"Is my deductible still\nthe same?"', 0.68, 4.86, 1.43, 0.34, { fontSize: 8.6, color: c.white, bold: true, valign: "top", breakLine: true });
  addText(slide, "First turn only", 0.68, 5.42, 1.03, 0.12, { fontSize: 6.8, color: c.muted });

  box(slide, 3.31, 4.31, 2.65, 1.42, "12342F", "2B827A");
  addText(slide, "Embed query", 3.51, 4.55, 1.11, 0.16, { fontSize: 9.1, bold: true });
  addText(slide, "Meaning, not keyword\nmatching, drives recall", 3.51, 4.86, 1.79, 0.34, { fontSize: 7.5, color: "C8FAF4", valign: "top", breakLine: true });
  addText(slide, "query vector", 3.51, 5.42, 0.9, 0.12, { fontFace: "Courier New", fontSize: 6.8, color: c.teal });

  box(slide, 6.41, 4.31, 3.27, 1.42, c.greenPanel, "2D8052");
  addText(slide, "Retrieve the best past sessions", 6.61, 4.55, 2.26, 0.16, { fontSize: 9.1, bold: true });
  addText(slide, "$vectorSearch filter: tenant_id + agent_id + customer_name", 6.61, 4.87, 2.68, 0.13, { fontFace: "Courier New", fontSize: 5.85, color: "C7F9D8" });
  addText(slide, "Top 3 semantic matches, not merely the latest 3", 6.61, 5.20, 2.62, 0.13, { fontSize: 6.8, color: "B7F4CA" });

  box(slide, 10.13, 4.31, 2.70, 1.42, c.purplePanel, "6B4DB1");
  addText(slide, "Inject relevant history", 10.33, 4.55, 1.73, 0.16, { fontSize: 9.1, bold: true });
  addText(slide, "summary + open actions\nbecome prompt context", 10.33, 4.86, 1.78, 0.34, { fontSize: 7.5, color: "E4DAFF", valign: "top", breakLine: true });
  addText(slide, "The agent responds with continuity.", 10.33, 5.42, 1.86, 0.12, { fontSize: 6.8, color: "DAB9FF" });

  arrow(slide, 2.90, 5.02, 3.21, 5.02, c.blue);
  arrow(slide, 6.00, 5.02, 6.31, 5.02, c.teal);
  arrow(slide, 9.72, 5.02, 10.03, 5.02, c.mongo);

  // Key callout
  box(slide, 0.48, 6.16, 12.35, 0.77, "10271F", "2D8052");
  tag(slide, "LONG-TERM MEMORY", 0.70, 6.39, 1.12, "1B5C3A", c.mongo);
  addText(slide, "Atlas stores durable memory outside the LLM context window, then restores only the semantically relevant, authorized context when it is useful.", 2.08, 6.37, 10.15, 0.17, { fontSize: 8.7, bold: true, color: "D4FFE1" });
  addText(slide, "Result: continuity across sessions without replaying every prior conversation.", 2.08, 6.64, 9.8, 0.12, { fontSize: 7.4, color: "B7F4CA" });
}

pptx.writeFile({ fileName: "deliverables/atlas-agent-context-and-long-term-memory.pptx" });
