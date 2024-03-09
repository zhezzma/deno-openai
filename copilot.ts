import { load } from "https://deno.land/std@0.219.0/dotenv/mod.ts";
const env = await load();

type CopilotToken = {
  token: string;
  expires_at: string;
};

let token: CopilotToken = {
  token: "",
  expires_at: "",
};
const vscode_sessionid = getRandomUuidv4() +
  String(Math.round(new Date().getTime()));
const machineid: string = Math.floor(Math.random() * 100000000000).toString(16);
async function authenticate(github_token: string): Promise<CopilotToken> {
  try {
    const response = await fetch(
      "https://api.github.com/copilot_internal/v2/token",
      {
        method: "GET",
        headers: {
          authorization: `token ${github_token}`,
          "editor-version": "vscode/1.80.1",
          "editor-plugin-version": "copilot-chat/0.4.1",
          "user-agent": "GitHubCopilotChat/0.4.1",
        },
      },
    );
    const result = await response.json();
    return result as CopilotToken;
  } catch (err) {
    console.log(
      "There was a problem when trying to authenticate to GitHub:\n",
    );
    console.log(err);
    console.log("\n\nMake sure you're connected to the internet.");
    throw err;
  }
}

export async function copilot(req: Request): Promise<Response> {
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
  let OPENAI_KEY = Deno.env.get("COPILOT_API_KEY") || env["COPILOT_API_KEY"] ||
    "";
  let OPENAI_MODEL = Deno.env.get("OPENAI_MODEL") || env["OPENAI_MODEL"] ||
    "gpt-4";
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
  if (!OPENAI_KEY) {
    throw new Error("Not authenticated");
  }
  if (token.token === "") {
    token = await authenticate(OPENAI_KEY);
  }

  try {
    const response = await fetch(
      "https://api.githubcopilot.com/chat/completions",
      {
        method: req.method,
        headers: {
          Authorization: `Bearer ${token.token}`,
          "X-Request-Id": String(getRandomUuidv4()),
          "Vscode-Sessionid": vscode_sessionid,
          Machineid: String(machineid),
          "Editor-Version": "vscode/1.80.1",
          "Editor-Plugin-Version": "copilot-chat/0.4.1",
          "Openai-Organization": "github-copilot",
          "Openai-Intent": "conversation-panel",
          "Content-Type": "application/json",
          "User-Agent": "GitHubCopilotChat/0.4.1",
        },
        body: JSON.stringify(params),
      },
    );
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
    result.object = "chat.completion";
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

function getRandomUuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
