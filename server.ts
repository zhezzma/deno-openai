import { load } from "https://deno.land/std@0.219.0/dotenv/mod.ts";
const env = await load();

const DEFAULT_ROUTE = new URLPattern({ pathname: "/" });
const CHATGPT_ROUTE = new URLPattern({ pathname: "/chatgpt" });
const CLAUDE_ROUTE = new URLPattern({ pathname: "/claude" });
async function handler(req: Request): Promise<Response> {
  if (CHATGPT_ROUTE.exec(req.url)) {
    return await handler_gpt(req);
  }
  if (CLAUDE_ROUTE.exec(req.url)) {
    return await handler_claude(req);
  }
  if (DEFAULT_ROUTE.exec(req.url)) {
    return handler_default(req);
  }
  return new Response("Not found", {
    status: 404,
  });
}

async function handler_gpt(req: Request): Promise<Response> {
  let OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || env["OPENAI_API_KEY"] ||
    "";

  return new Response(OPENAI_KEY);
}

async function handler_claude(req: Request): Promise<Response> {
  return new Response("Not found");
}

function handler_default(req: Request): Response {
  return new Response(
    `<ui>
  <li><a href="/chatgpt">ChatGPT</a></li>
  <li><a href="/claude">Claude</a></li>
  </ui>`,
    {
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    },
  );
}

Deno.serve(handler);
