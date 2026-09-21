const pptxgen = require("pptxgenjs");

const pptx = new pptxgen();
pptx.defineLayout({ name: "WIDE", width: 13.333, height: 7.5 });
pptx.layout = "WIDE";
pptx.author = "MongoDB Cerbos MCP";
pptx.company = "MongoDB";
pptx.subject = "Insurance Customer 360 and governed AI architecture";
pptx.title = "Insurance Customer 360 and governed AI";
pptx.lang = "en-US";
pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial", lang: "en-US" };

const c = {
  ink: "001E2B", green: "00ED64", deepGreen: "00684A", midGreen: "00A35C",
  paleGreen: "E3FCF0", paleGreen2: "F3FFF9", cream: "F9FAF3", white: "FFFFFF",
  gray: "5C6C75", lightGray: "D7DEE0", line: "9BACB2", dark: "21313C",
  blue: "006CFA", paleBlue: "EAF2FF", amber: "F4B41A", paleAmber: "FFF8E1",
  future: "8263C6", paleFuture: "F2EEFC",
};

function addText(slide, value, x, y, w, h, options = {}) {
  slide.addText(value, {
    x, y, w, h, margin: 0, fit: "shrink", valign: "mid",
    fontFace: "Arial", fontSize: 10, color: c.ink,
    breakLine: false, ...options,
  });
}

function rect(slide, x, y, w, h, fill, line = c.line, radius = 0.05) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: radius,
    fill: { color: fill }, line: { color: line, width: 0.75 },
  });
}

function line(slide, x1, y1, x2, y2, color = c.line, width = 1.1, arrow = true, dash = "solid") {
  slide.addShape(pptx.ShapeType.line, {
    x: x1, y: y1, w: x2 - x1, h: y2 - y1,
    line: { color, width, dash, beginArrowType: "none", endArrowType: arrow ? "triangle" : "none" },
  });
}

function tag(slide, label, x, y, w, fill, color = c.white) {
  rect(slide, x, y, w, 0.22, fill, fill, 0.04);
  addText(slide, label, x + 0.05, y + 0.015, w - 0.1, 0.16, {
    fontSize: 6.2, bold: true, color, align: "center",
  });
}

function bullet(slide, text, x, y, w, color = c.ink, bulletColor = c.green) {
  slide.addShape(pptx.ShapeType.ellipse, {
    x, y: y + 0.055, w: 0.065, h: 0.065,
    fill: { color: bulletColor }, line: { color: bulletColor, transparency: 100 },
  });
  addText(slide, text, x + 0.12, y, w - 0.12, 0.16, { fontSize: 7.2, color });
}

function footer(slide, page) {
  slide.background = { color: c.cream };
  slide.addShape(pptx.ShapeType.line, {
    x: 0, y: 0.04, w: 13.333, h: 0,
    line: { color: c.ink, width: 0.8 },
  });
  // Native text/logo treatment mirrors the clean sample master while preserving editability.
  slide.addShape(pptx.ShapeType.diamond, {
    x: 0.67, y: 6.88, w: 0.13, h: 0.26,
    rotate: 0, fill: { color: c.ink }, line: { color: c.ink, transparency: 100 },
  });
  addText(slide, "MongoDB", 0.86, 6.92, 1.28, 0.22, { fontSize: 16.5, fontFace: "Georgia", bold: false });
  addText(slide, "BUILD ANYTHING. CHANGE EVERYTHING.", 2.55, 6.98, 2.55, 0.13, { fontSize: 6.3, fontFace: "Georgia", bold: true });
  addText(slide, String(page), 12.60, 6.98, 0.18, 0.13, { fontSize: 6.7, fontFace: "Georgia", align: "right" });
}

function sourceCard(slide, x, y, title, data, accent, future = false) {
  rect(slide, x, y, 2.08, 0.86, c.white, future ? c.future : accent);
  tag(slide, future ? "FUTURE-STATE SOURCE" : "SYSTEM OF RECORD", x + 0.12, y + 0.11, future ? 1.16 : 1.07, future ? c.future : accent);
  addText(slide, title, x + 0.12, y + 0.37, 1.80, 0.16, { fontSize: 9.0, bold: true });
  addText(slide, data, x + 0.12, y + 0.59, 1.78, 0.15, { fontSize: 6.45, color: c.gray });
}

// Slide 1: Customer 360 foundation.
{
  const slide = pptx.addSlide();
  footer(slide, 1);
  tag(slide, "CUSTOMER 360 FOUNDATION", 0.52, 0.34, 1.78, c.deepGreen);
  addText(slide, "Unify insurance customer context without replacing systems of record", 0.52, 0.67, 11.8, 0.38, { fontSize: 21.5, bold: true });
  addText(slide, "Synchronize the context needed for personalized service, renewals, and claims-aware conversations into an AI-ready Customer 360 profile.", 0.52, 1.10, 12.05, 0.20, { fontSize: 8.9, color: c.gray });

  addText(slide, "1. INSURANCE ENGAGEMENT AND SYSTEM-OF-RECORD DATA", 0.52, 1.52, 3.45, 0.15, { fontSize: 7.0, bold: true, color: c.deepGreen });
  const sourceY = [1.84, 2.83, 3.82, 4.81, 5.80];
  sourceCard(slide, 0.52, sourceY[0], "Salesforce / CRM", "Profile, lifecycle, segment, deals, next steps", c.blue);
  sourceCard(slide, 0.52, sourceY[1], "Policy Administration", "Coverage, premium, deductible, status, expiry", c.midGreen);
  sourceCard(slide, 0.52, sourceY[2], "Claims System", "Claim type, status, milestone, adjuster, documents", c.future, true);
  sourceCard(slide, 0.52, sourceY[3], "Contact Center", "Calls, emails, notes, tasks, outcomes, due dates", c.amber);
  sourceCard(slide, 0.52, sourceY[4], "Customer Portal", "Questions, chat summaries, service commitments", c.deepGreen);

  // Multiple inputs converge to the unified profile.
  sourceY.forEach((y, i) => line(slide, 2.66, y + 0.43, 3.00, 3.68, i === 2 ? c.future : c.line, 0.9, true, i === 2 ? "dash" : "solid"));

  rect(slide, 3.25, 1.78, 5.14, 4.88, c.paleGreen2, c.midGreen);
  tag(slide, "MONGODB ATLAS", 3.49, 2.00, 1.04, c.deepGreen);
  addText(slide, "Unified Customer 360 Profile", 3.49, 2.35, 4.42, 0.28, { fontSize: 16.8, bold: true });
  addText(slide, "One operational customer record that combines current facts, relationship context, and service history.", 3.49, 2.70, 4.44, 0.26, { fontSize: 8.2, color: c.gray });
  slide.addShape(pptx.ShapeType.line, { x: 3.49, y: 3.08, w: 4.65, h: 0, line: { color: c.lightGray, width: 0.7 } });

  const profileItems = [
    ["Customer relationship", "identity, segment, lifecycle, preferred channel"],
    ["Policies and renewals", "coverage, premium, deductible, status, expiry"],
    ["Claims context", "current status, owner, milestone, requested documents"],
    ["Interaction timeline", "calls, emails, tasks, chat summaries, commitments"],
  ];
  profileItems.forEach(([title, desc], i) => {
    const y = 3.33 + i * 0.60;
    rect(slide, 3.49, y, 4.65, 0.45, c.white, "B6D8C8");
    addText(slide, title, 3.67, y + 0.09, 1.55, 0.14, { fontSize: 7.8, bold: true });
    addText(slide, desc, 5.30, y + 0.09, 2.58, 0.14, { fontSize: 6.8, color: c.gray });
  });
  rect(slide, 3.49, 5.91, 4.65, 0.49, c.deepGreen, c.deepGreen);
  addText(slide, "CRM remains the system of engagement. Atlas becomes the AI-ready Customer 360 data foundation.", 3.69, 6.04, 4.24, 0.14, { fontSize: 7.0, bold: true, color: c.white, align: "center" });

  line(slide, 8.45, 3.68, 8.92, 3.68, c.midGreen, 1.35);
  addText(slide, "2. DOWNSTREAM AI USE CASES", 9.16, 1.52, 2.76, 0.15, { fontSize: 7.0, bold: true, color: c.deepGreen });
  rect(slide, 9.16, 1.84, 3.66, 1.30, c.white, c.deepGreen);
  tag(slide, "AGENT CUSTOMER 360 COPILOT", 9.37, 2.02, 1.42, c.deepGreen);
  addText(slide, "Prepare and answer in context", 9.37, 2.34, 2.98, 0.18, { fontSize: 10.2, bold: true });
  bullet(slide, "Brief an agent before a customer call", 9.37, 2.61, 3.00);
  bullet(slide, "Answer what changed since the last interaction", 9.37, 2.84, 3.00);

  rect(slide, 9.16, 3.55, 3.66, 1.30, c.white, c.deepGreen);
  tag(slide, "AI-ASSISTED NEXT ACTION", 9.37, 3.73, 1.38, c.deepGreen);
  addText(slide, "Recommend the next human step", 9.37, 4.05, 2.98, 0.18, { fontSize: 10.2, bold: true });
  bullet(slide, "Renewal outreach, callback, or document follow-up", 9.37, 4.32, 3.00);
  bullet(slide, "Future: claims document request or routing", 9.37, 4.55, 3.00);

  rect(slide, 9.16, 5.26, 3.66, 1.14, c.white, c.deepGreen);
  tag(slide, "CUSTOMER SELF-SERVICE", 9.37, 5.44, 1.17, c.deepGreen);
  addText(slide, "Policy and service assistant", 9.37, 5.76, 3.00, 0.18, { fontSize: 9.1, bold: true });
  addText(slide, "Answer coverage, premium, deductible, status, and expiry questions with relevant prior portal context. Future: claims status context.", 9.37, 6.02, 3.03, 0.22, { fontSize: 6.8, color: c.gray });
}

// Slide 2: Governed AI and next-action use cases.
{
  const slide = pptx.addSlide();
  footer(slide, 2);
  tag(slide, "GOVERNED AI USE CASES", 0.52, 0.34, 1.70, c.deepGreen);
  addText(slide, "Four concrete Customer 360 cases powered by semantic retrieval", 0.52, 0.67, 12.1, 0.38, { fontSize: 21.0, bold: true });
  addText(slide, "For each case, Atlas combines structured facts with semantically relevant interactions and chat memory before InsureAI proposes a grounded human action.", 0.52, 1.10, 12.05, 0.20, { fontSize: 8.8, color: c.gray });

  const columns = [
    [0.52, 2.75, "SOURCE DATA"],
    [3.42, 3.02, "SEMANTIC SEARCH"],
    [6.62, 3.25, "MATCHED CONTEXT"],
    [10.05, 2.77, "AI-ASSISTED OUTPUT"],
  ];
  columns.forEach(([x, w, label]) => addText(slide, label, x, 1.55, w, 0.14, { fontSize: 6.8, bold: true, color: c.deepGreen, align: "center" }));
  const cases = [
    {
      label: "1  RENEWAL OUTREACH PREPARATION",
      source: "CRM: lifecycle = Renewal; deal next step\nPolicy: expiry in 21 days\nContact center: call about renewal price",
      query: '"renewal price concern or expiring coverage"',
      match: "Alice called about renewal affordability. Open CRM quote follow-up; auto policy expires in 21 days.",
      output: "Call Alice this week. Discuss renewal quote and use her preferred phone channel.",
      color: c.blue,
    },
    {
      label: "2  PROMISED DOCUMENT FOLLOW-UP",
      source: "Contact center: call outcome\nPortal chat: session summary\nCRM: task status = Open",
      query: '"promised renewal documents or quote"',
      match: "Chat summary: \"Send renewal quote by Friday.\" The related service task is still open.",
      output: "Send the renewal packet. Cite the Friday commitment and close the follow-up after delivery.",
      color: c.midGreen,
    },
    {
      label: "3  CLAIMS-AWARE SERVICE CONVERSATION  |  FUTURE STATE",
      source: "Claims: water-damage claim, proof-of-loss pending\nPolicy: home coverage\nInteractions: missing-document questions",
      query: '"missing claim documents or claim status"',
      match: "Open water-damage claim awaits proof-of-loss. Recent call asked which documents are required.",
      output: "Confirm document requirements and route the customer to the assigned adjuster.",
      color: c.future,
    },
    {
      label: "4  SERVICE CALLBACK PRIORITIZATION",
      source: "CRM: preferred contact = Phone\nActivity: callback task = Open\nPortal chat: deductible concern after repair estimate",
      query: '"callback about deductible or repair estimate"',
      match: "Bob asked whether the deductible changes after a repair estimate. Callback remains open.",
      output: "Call Bob. Explain the deductible using current policy data and resolve the open task.",
      color: c.amber,
    },
  ];

  function caseRow(item, y) {
    rect(slide, 0.52, y, 12.30, 1.16, c.white, item.color);
    tag(slide, item.label, 0.70, y + 0.12, item.label.length > 40 ? 2.55 : 2.18, item.color);
    addText(slide, item.source, 0.70, y + 0.43, 2.40, 0.49, { fontSize: 6.5, color: c.dark, valign: "top", breakLine: true });
    line(slide, 3.14, y + 0.58, 3.34, y + 0.58, item.color, 1.0);
    rect(slide, 3.42, y + 0.31, 3.02, 0.55, c.paleBlue, "B7CDF9");
    addText(slide, item.query, 3.60, y + 0.47, 2.64, 0.17, { fontSize: 6.9, bold: true, color: c.blue, align: "center" });
    addText(slide, "ATLAS VECTOR SEARCH", 3.68, y + 0.72, 2.48, 0.10, { fontSize: 5.7, bold: true, color: c.gray, align: "center" });
    line(slide, 6.46, y + 0.58, 6.58, y + 0.58, item.color, 1.0);
    rect(slide, 6.66, y + 0.25, 3.10, 0.67, c.paleGreen2, "B6D8C8");
    addText(slide, item.match, 6.83, y + 0.37, 2.76, 0.42, { fontSize: 6.35, color: c.dark, valign: "mid" });
    line(slide, 9.80, y + 0.58, 9.99, y + 0.58, item.color, 1.0);
    rect(slide, 10.07, y + 0.25, 2.54, 0.67, c.paleGreen, item.color);
    addText(slide, item.output, 10.23, y + 0.37, 2.22, 0.42, { fontSize: 6.4, bold: true, color: c.ink, valign: "mid" });
  }

  cases.forEach((item, index) => caseRow(item, 1.83 + index * 1.19));

  rect(slide, 0.52, 6.62, 12.30, 0.28, c.ink, c.ink);
  addText(slide, "CERBOS IDENTITY POLICY  ->  ATLAS AUTHORIZATION FILTER  ->  AUTHORIZED VECTOR SEARCH  ->  GROUNDED AI ACTION", 0.76, 6.70, 7.40, 0.10, { fontSize: 6.2, bold: true, color: c.green });
  addText(slide, "Only authorized customer facts and interaction memory enter semantic ranking.", 8.30, 6.70, 4.12, 0.10, { fontSize: 6.3, bold: true, color: c.paleGreen, align: "right" });
}

// Slide 3: Traditional Chinese version of the Customer 360 foundation.
{
  const slide = pptx.addSlide();
  footer(slide, 3);
  const zh = { fontFace: "PingFang TC" };
  tag(slide, "客戶 360 基礎", 0.52, 0.34, 1.40, c.deepGreen);
  addText(slide, "整合保險客戶脈絡，無須取代既有的系統紀錄", 0.52, 0.67, 11.8, 0.38, { fontSize: 21.5, bold: true, ...zh });
  addText(slide, "同步個人化服務、續保及理賠服務對話所需的脈絡，建立可供 AI 使用的 Customer 360 客戶輪廓。", 0.52, 1.10, 12.05, 0.20, { fontSize: 8.9, color: c.gray, ...zh });

  addText(slide, "1. 保險互動與系統紀錄資料", 0.52, 1.52, 3.45, 0.15, { fontSize: 7.0, bold: true, color: c.deepGreen, ...zh });
  const sourceY = [1.84, 2.83, 3.82, 4.81, 5.80];
  const sources = [
    ["Salesforce / CRM", "客戶輪廓、生命週期、商機、下一步", c.blue, false],
    ["保單管理系統", "保障範圍、保費、自負額、到期日", c.midGreen, false],
    ["理賠系統", "理賠類型、狀態、進度、理算人員、文件", c.future, true],
    ["聯絡中心", "電話、電郵、備註、任務、結果、到期日", c.amber, false],
    ["客戶入口網站", "問題、聊天摘要、服務承諾", c.deepGreen, false],
  ];
  sources.forEach(([title, data, accent, future], i) => {
    rect(slide, 0.52, sourceY[i], 2.08, 0.86, c.white, future ? c.future : accent);
    tag(slide, future ? "未來狀態資料來源" : "系統紀錄來源", 0.64, sourceY[i] + 0.11, future ? 1.15 : 0.92, future ? c.future : accent);
    addText(slide, title, 0.64, sourceY[i] + 0.37, 1.80, 0.16, { fontSize: 8.9, bold: true, ...zh });
    addText(slide, data, 0.64, sourceY[i] + 0.59, 1.78, 0.15, { fontSize: 6.4, color: c.gray, ...zh });
    line(slide, 2.66, sourceY[i] + 0.43, 3.00, 3.68, future ? c.future : c.line, 0.9, true, future ? "dash" : "solid");
  });

  rect(slide, 3.25, 1.78, 5.14, 4.88, c.paleGreen2, c.midGreen);
  tag(slide, "MONGODB ATLAS", 3.49, 2.00, 1.04, c.deepGreen);
  addText(slide, "整合式 Customer 360 客戶輪廓", 3.49, 2.35, 4.42, 0.28, { fontSize: 16.5, bold: true, ...zh });
  addText(slide, "將即時事實、客戶關係脈絡及服務歷史整合為一筆可營運的客戶紀錄。", 3.49, 2.70, 4.44, 0.26, { fontSize: 8.2, color: c.gray, ...zh });
  slide.addShape(pptx.ShapeType.line, { x: 3.49, y: 3.08, w: 4.65, h: 0, line: { color: c.lightGray, width: 0.7 } });
  const profileItems = [
    ["客戶關係", "身分、客群、生命週期、偏好管道"],
    ["保單與續保", "保障、保費、自負額、狀態、到期日"],
    ["理賠脈絡", "目前狀態、負責人、進度、待補文件"],
    ["互動時間軸", "電話、電郵、任務、聊天摘要、承諾"],
  ];
  profileItems.forEach(([title, desc], i) => {
    const y = 3.33 + i * 0.60;
    rect(slide, 3.49, y, 4.65, 0.45, c.white, "B6D8C8");
    addText(slide, title, 3.67, y + 0.09, 1.55, 0.14, { fontSize: 7.8, bold: true, ...zh });
    addText(slide, desc, 5.30, y + 0.09, 2.58, 0.14, { fontSize: 6.8, color: c.gray, ...zh });
  });
  rect(slide, 3.49, 5.91, 4.65, 0.49, c.deepGreen, c.deepGreen);
  addText(slide, "CRM 保持客戶互動系統角色；Atlas 成為 AI-ready Customer 360 資料基礎。", 3.69, 6.04, 4.24, 0.14, { fontSize: 7.0, bold: true, color: c.white, align: "center", ...zh });
  line(slide, 8.45, 3.68, 8.92, 3.68, c.midGreen, 1.35);

  addText(slide, "2. 下游 AI 使用案例", 9.16, 1.52, 2.76, 0.15, { fontSize: 7.0, bold: true, color: c.deepGreen, ...zh });
  const aiCards = [
    [1.84, "客戶 360 智能助理", "在脈絡中準備與回應", "通話前提供客戶簡報", "回答上次互動後有何變化", 1.45],
    [3.55, "AI 輔助下一步行動", "建議下一個人工作業", "續保聯絡、回電或文件追蹤", "未來：理賠文件請求或轉派", 1.40],
    [5.26, "客戶自助服務", "保單與服務助理", "回答保障、保費、自負額、狀態及到期日", "未來：提供理賠狀態脈絡", 1.12],
  ];
  aiCards.forEach(([y, label, title, a, b, width]) => {
    rect(slide, 9.16, y, 3.66, y === 5.26 ? 1.14 : 1.30, c.white, c.deepGreen);
    tag(slide, label, 9.37, y + 0.18, width, c.deepGreen);
    addText(slide, title, 9.37, y + 0.50, 2.98, 0.18, { fontSize: 10.0, bold: true, ...zh });
    bullet(slide, a, 9.37, y + 0.77, 3.00, c.ink, c.green);
    if (y !== 5.26) bullet(slide, b, 9.37, y + 1.00, 3.00, c.ink, c.green);
    else addText(slide, b, 9.49, y + 0.99, 2.95, 0.12, { fontSize: 6.7, color: c.gray, ...zh });
  });
}

// Slide 4: Traditional Chinese version of concrete governed AI use cases.
{
  const slide = pptx.addSlide();
  footer(slide, 4);
  const zh = { fontFace: "PingFang TC" };
  tag(slide, "受治理的 AI 使用案例", 0.52, 0.34, 1.72, c.deepGreen);
  addText(slide, "以語意檢索驅動四個具體的 Customer 360 案例", 0.52, 0.67, 12.1, 0.38, { fontSize: 21.0, bold: true, ...zh });
  addText(slide, "每個案例均先整合結構化事實、再找出語意相關的互動與聊天記憶，最後由 InsureAI 提出有依據的人工作業建議。", 0.52, 1.10, 12.05, 0.20, { fontSize: 8.8, color: c.gray, ...zh });
  [[0.52, 2.75, "來源資料"], [3.42, 3.02, "語意搜尋"], [6.62, 3.25, "命中的相關脈絡"], [10.05, 2.77, "AI 輔助輸出"]]
    .forEach(([x, w, label]) => addText(slide, label, x, 1.55, w, 0.14, { fontSize: 6.8, bold: true, color: c.deepGreen, align: "center", ...zh }));

  const cases = [
    ["1  續保外聯準備", "CRM：生命週期 = 續保；商機下一步\n保單：21 天後到期\n聯絡中心：曾詢問續保價格", "「續保價格疑慮或即將到期的保障」", "Alice 曾致電詢問續保負擔能力；CRM 尚有待追蹤的報價，汽車保單 21 天後到期。", "本週致電 Alice，討論續保報價，並使用她偏好的電話聯絡管道。", c.blue],
    ["2  已承諾文件追蹤", "聯絡中心：通話結果\n入口網站：聊天摘要\nCRM：任務狀態 = 開啟", "「已承諾的續保文件或報價」", "聊天摘要：\"週五前寄出續保報價。\" 對應的服務任務仍處於開啟狀態。", "寄出續保文件包；引用週五前的承諾，送達後結案。", c.midGreen],
    ["3  理賠服務對話  |  未來狀態", "理賠：水損案件、待補損失證明\n保單：住宅保障\n互動：詢問缺少文件", "「缺少理賠文件或理賠狀態」", "水損理賠案仍等待損失證明；最近通話曾詢問所需文件。", "確認待補文件要求，並將客戶轉介給指派的理算人員。", c.future],
    ["4  服務回電優先排序", "CRM：偏好管道 = 電話\n活動：回電任務 = 開啟\n入口網站：維修估價後的自負額疑慮", "「關於自負額或維修估價的回電」", "Bob 詢問維修估價後自負額是否改變；回電任務仍處於開啟狀態。", "致電 Bob，依目前保單說明自負額，並完成開啟的任務。", c.amber],
  ];
  function caseRow(item, y) {
    const [label, source, query, match, output, color] = item;
    rect(slide, 0.52, y, 12.30, 1.16, c.white, color);
    tag(slide, label, 0.70, y + 0.12, label.length > 22 ? 2.55 : 2.18, color);
    addText(slide, source, 0.70, y + 0.43, 2.40, 0.49, { fontSize: 6.45, color: c.dark, valign: "top", breakLine: true, ...zh });
    line(slide, 3.14, y + 0.58, 3.34, y + 0.58, color, 1.0);
    rect(slide, 3.42, y + 0.31, 3.02, 0.55, c.paleBlue, "B7CDF9");
    addText(slide, query, 3.60, y + 0.47, 2.64, 0.17, { fontSize: 6.7, bold: true, color: c.blue, align: "center", ...zh });
    addText(slide, "ATLAS VECTOR SEARCH", 3.68, y + 0.72, 2.48, 0.10, { fontSize: 5.7, bold: true, color: c.gray, align: "center" });
    line(slide, 6.46, y + 0.58, 6.58, y + 0.58, color, 1.0);
    rect(slide, 6.66, y + 0.25, 3.10, 0.67, c.paleGreen2, "B6D8C8");
    addText(slide, match, 6.83, y + 0.37, 2.76, 0.42, { fontSize: 6.2, color: c.dark, valign: "mid", ...zh });
    line(slide, 9.80, y + 0.58, 9.99, y + 0.58, color, 1.0);
    rect(slide, 10.07, y + 0.25, 2.54, 0.67, c.paleGreen, color);
    addText(slide, output, 10.23, y + 0.37, 2.22, 0.42, { fontSize: 6.25, bold: true, color: c.ink, valign: "mid", ...zh });
  }
  cases.forEach((item, index) => caseRow(item, 1.83 + index * 1.19));
  rect(slide, 0.52, 6.62, 12.30, 0.28, c.ink, c.ink);
  addText(slide, "CERBOS 身分政策  ->  ATLAS 授權篩選條件  ->  已授權的向量搜尋  ->  有依據的 AI 行動", 0.76, 6.70, 7.40, 0.10, { fontSize: 6.2, bold: true, color: c.green, ...zh });
  addText(slide, "只有已授權的客戶事實與互動記憶會進入語意排名。", 8.30, 6.70, 4.12, 0.10, { fontSize: 6.3, bold: true, color: c.paleGreen, align: "right", ...zh });
}

pptx.writeFile({ fileName: "deliverables/insurance-customer-360-governed-ai.pptx" });
