const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

// ─── CORS Helper ──────────────────────────────────────────────
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer(async (req, res) => {

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    setCORS(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // ─── Static File Server ──────────────────────────────────────
  if (req.method === "GET") {
    let filePath = "." + (req.url === "/" ? "/index.html" : req.url);
    const extname = path.extname(filePath);
    const mimeTypes = {
      ".html": "text/html",
      ".js":   "text/javascript",
      ".css":  "text/css",
      ".json": "application/json",
      ".png":  "image/png",
      ".jpg":  "image/jpeg",
      ".svg":  "image/svg+xml",
      ".ico":  "image/x-icon",
    };
    const contentType = mimeTypes[extname] || "text/plain";

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("File not found: " + filePath);
      } else {
        setCORS(res);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      }
    });
    return;
  }

  // ─── /analyze  — Hugging Face Proxy ──────────────────────────
  // Expects JSON body:
  // {
  //   token: "hf_...",          ← user supplies from UI
  //   model: "...",
  //   messages: [...],
  //   max_tokens: 2048,
  //   temperature: 0.3
  // }
  if (req.method === "POST" && req.url === "/analyze") {
    let body = "";

    req.on("data", chunk => { body += chunk; });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const { token, model, messages, max_tokens, temperature } = payload;

        if (!token || !token.startsWith("hf_")) {
          setCORS(res);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing or invalid Hugging Face token. Token must start with 'hf_'." }));
          return;
        }

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
          setCORS(res);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "messages array is required." }));
          return;
        }

        const hfUrl = "https://router.huggingface.co/v1/chat/completions";

        const hfResponse = await fetch(hfUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: model || "meta-llama/Llama-3.3-70B-Instruct",
            messages,
            max_tokens: max_tokens || 2048,
            temperature: temperature || 0.3
          })
        });

        const data = await hfResponse.json();

        setCORS(res);
        res.writeHead(hfResponse.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));

      } catch (error) {
        console.error("Proxy Error:", error);
        setCORS(res);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Server Error", details: error.message }));
      }
    });
    return;
  }

  // ─── 404 Fallback ─────────────────────────────────────────────
  setCORS(res);
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  MeetingVerse X  —  AI Intelligence Lab  ║`);
  console.log(`╠══════════════════════════════════════════╣`);
  console.log(`║  Running at: http://localhost:${PORT}          ║`);
  console.log(`║  HF Token:   Supplied by user via UI      ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});
