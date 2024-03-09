import { load } from "https://deno.land/std@0.219.0/dotenv/mod.ts";
const env = await load();

const encoder = new TextEncoder();
const decoder = new TextDecoder();
let raw_start_message = "";
let request_gpt_model = "";
let buffer = "";

const stop_reason_map: any = {
  end_turn: "stop",
  stop_sequence: "stop",
  max_tokens: "length",
};
const DEFAULT_ROUTE = new URLPattern({ pathname: "/" });
const CHATGPT_ROUTE = new URLPattern({
  pathname: "/chatgpt/:optional*",
});
const CLAUDE_ROUTE = new URLPattern({ pathname: "/claude/:optional*" });
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

async function handler_claude(req: Request): Promise<Response> {
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

  let ANTHROPIC_KEY = env.ANTHROPIC_API_KEY || "";
  let ANTHROPIC_MODEL = env.ANTHROPIC_MODEL || "claude-3-opus-20240229";
  const MAX_TOKENS = 4096;

  // 打印请求参数到日志，方便排查
  const headers = Object.fromEntries(req.headers);
  const params = await req.json();
  console.log(params);
  console.log(headers);
  ANTHROPIC_KEY = headers["authorization"]
    ? headers["authorization"].split(" ")[1]
    : ANTHROPIC_KEY;
  ANTHROPIC_KEY = headers["x-api-key"] || ANTHROPIC_KEY;
  request_gpt_model = params.model || "gpt-3.5-turbo";

  //处理参数
  let data: any = {};
  if (params.model.includes("claude")) {
    ANTHROPIC_MODEL = params.model || ANTHROPIC_MODEL;
  }
  data.model = ANTHROPIC_MODEL;
  // 假设params对象已经定义，并且包含上述的messages属性
  let systemMessageContent = null;
  // 遍历messages数组，查找role为'system'的记录
  data.messages = params.messages.filter(function (message: any) {
    if (message.role === "system") {
      // 找到了system角色，保存content
      systemMessageContent = message.content;
      // 返回false以从数组中移除该元素
      return false;
    }
    // 对于其他角色，保留在数组中
    return true;
  });
  // 如果找到了system角色的记录，则将其content赋值给params.system
  if (systemMessageContent !== null) {
    data.system = systemMessageContent;
  }
  data.temperature = params.temperature || 1.0;
  data.max_tokens = MAX_TOKENS;
  data.stream = params.stream || false;
  console.log(ANTHROPIC_KEY);
  console.log(ANTHROPIC_MODEL);
  console.log("stream:" + data.stream);
  console.log("Send data:", data);
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": `${ANTHROPIC_KEY}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(data),
    });
    if (data.stream) {
      const { readable, writable } = new TransformStream();
      streamJsonResponseBodies(response, writable);
      return new Response(readable, {
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
    return new Response(JSON.stringify(claudeToChatGPTResponse(result)), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify(error), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function claudeToChatGPTResponse(claudeResponse: any, stream = false) {
  const result: any = {
    id: "chatcmpl-" + claudeResponse.id.substring(4),
    created: Math.floor(Date.now() / 1000),
    model: request_gpt_model,
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: claudeResponse["stop_reason"]
          ? stop_reason_map[claudeResponse["stop_reason"]]
          : null,
      },
    ],
  };

  if (!stream) {
    result.object = "chat.completion";
    result.usage = {
      prompt_tokens: claudeResponse.usage.input_tokens,
      completion_tokens: claudeResponse.usage.output_tokens,
      total_tokens: claudeResponse.usage.input_tokens +
        claudeResponse.usage.output_tokens,
    };
    result.choices[0].message = {
      role: "assistant",
      content: claudeResponse.content[0].text,
    };
  } else {
    result.object = "chat.completion.chunk";
    result.choices[0].delta = {};
    if (claudeResponse.content && claudeResponse.content.length > 0) {
      result.choices[0].delta = {
        content: claudeResponse.content[0].text,
      };
    }
  }
  return result;
}

async function streamJsonResponseBodies(
  response: Response,
  writable: WritableStream,
) {
  const reader = response.body!.getReader();
  const writer = writable.getWriter();
  // 这个函数用来读取和处理每一个数据块
  async function processChunk(
    { done, value }: ReadableStreamDefaultReadResult<Uint8Array>,
  ) {
    if (done) {
      raw_start_message = "";
      // 当没有更多数据时关闭流
      writer.close();
      return;
    }
    // 把 Uint8Array 转换为字符串
    buffer += decoder.decode(value); // stream: true is important here,fix the bug of incomplete line
    const chunk_arr = buffer.split("\n\n");
    const lastMsg = chunk_arr.length - 1;
    0 !== chunk_arr[lastMsg].length ? buffer = chunk_arr[lastMsg] : buffer = "";
    for (let i = 0; i < lastMsg; i++) {
      const chunk = chunk_arr[i];
      console.log(chunk);
      const data = JSON.parse(chunk.split("\n")[1].substring(5));
      console.log(data);
      console.log("------------------------");
      const event = data.type;
      if (event === "message_start") {
        raw_start_message = JSON.stringify(data.message);
      } else if (event === "content_block_start") {
      } else if (event === "content_block_delta") {
        let modified_message = JSON.parse(raw_start_message);
        modified_message.content = [{ text: data.delta.text }];
        modified_message = claudeToChatGPTResponse(modified_message, true);
        // 将修改后的数据块写入 writable
        writer.write(
          encoder.encode(`data: ${JSON.stringify(modified_message)}\n\n`),
        );
      } else if (event === "content_block_stop") {
      } else if (event === "message_delta") {
        let modified_message = JSON.parse(raw_start_message);
        modified_message.content = [];
        modified_message.stop_reason = data.delta.stop_reason;
        modified_message.stop_sequence = data.delta.stop_sequence;
        modified_message.usage.output_tokens = data.usage.output_tokens;
        modified_message = claudeToChatGPTResponse(modified_message, true);
        writer.write(
          encoder.encode(`data: ${JSON.stringify(modified_message)}\n\n`),
        );
      } else if (event === "message_stop") {
        writer.write(encoder.encode("data: [DONE]"));
      } else if (event === "ping") {
      }
    }
    // 读取下一个数据块
    processChunk(await reader.read());
  }
  // 开始读取第一个数据块
  processChunk(await reader.read());
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
