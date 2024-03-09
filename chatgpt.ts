import { load } from "https://deno.land/std@0.219.0/dotenv/mod.ts";
const env = await load();

export async function chatgpt(req: Request): Promise<Response> {
  if (req.method === "GET") {
    return new Response("Not GET GPT", { status: 404 });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  }

  let OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") || env["OPENAI_API_KEY"] ||
    "";
  let OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || env["OPENAI_MODEL"] ||
    "gpt-3.5-turbo";
  const headers = Object.fromEntries(req.headers);
  const params = await req.json();
  params.stream = params.stream || false;
  OPENAI_MODEL = params.model || OPENAI_MODEL;
  OPENAI_KEY = headers["authorization"]
    ? headers["authorization"].split(" ")[1]
    : OPENAI_KEY;
  console.log(params);
  console.log(headers);
  console.log(OPENAI_KEY);
  console.log(OPENAI_MODEL);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(params),
    });
    if (params.stream) {
      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "*",
          "Access-Control-Allow-Headers": "*",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }
    const result = await response.json();
    console.log(result);
    return new Response(JSON.stringify(result), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // 错误处理，首先打印错误到日志中，方便排查
    console.error(error);
    return new Response(error, {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
