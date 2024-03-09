import { chatgpt } from "./chatgpt.ts";
import { claude } from "./claude.ts";
import { copilot } from "./copilot.ts";
import { github } from "./github.ts";
const DEFAULT_ROUTE = new URLPattern({ pathname: "/" });
const CHATGPT_ROUTE = new URLPattern({ pathname: "/chatgpt/:optional*" });
const CLAUDE_ROUTE = new URLPattern({ pathname: "/claude/:optional*" });
const COPILOT_ROUTE = new URLPattern({ pathname: "/copilot/:optional*" });
const GITHUB_ROUTE = new URLPattern({ pathname: "/github/:optional*" });
async function handler(req: Request): Promise<Response> {
  if (CHATGPT_ROUTE.exec(req.url)) {
    return await chatgpt(req);
  }
  if (CLAUDE_ROUTE.exec(req.url)) {
    return await claude(req);
  }
  if (COPILOT_ROUTE.exec(req.url)) {
    return await copilot(req);
  }
  if (GITHUB_ROUTE.exec(req.url)) {
    return await github(req);
  }
  if (DEFAULT_ROUTE.exec(req.url)) {
    return new Response(
      `<ui>
    <li><a href="/chatgpt">ChatGPT</a></li>
    <li><a href="/claude">Claude</a></li>
    <li><a href="/copilot">Copilot</a></li>
    <li><a href="/github">Github</a></li>
    </ui>`,
      {
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      },
    );
  }
  return new Response("Not found", {
    status: 404,
  });
}

Deno.serve(handler);
