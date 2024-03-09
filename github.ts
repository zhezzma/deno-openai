type AuthResponse = {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
};

const LOGIN_HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
  "editor-version": "Neovim/0.9.2",
  "editor-plugin-version": "copilot.lua/1.11.4",
  "user-agent": "GithubCopilot/1.133.0",
};
const time_out = 30 * 1000;

export async function checkGithubAuth(deviceCode: string): Promise<string> {
  const url = "https://github.com/login/oauth/access_token";

  const accessTokenResponse = await fetch(url, {
    method: "POST",
    headers: LOGIN_HEADERS,
    body: JSON.stringify({
      client_id: "Iv1.b507a08c87ecfe98",
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });

  if (!accessTokenResponse.ok) {
    console.log("Failed to fetch access token");
    return "";
  }

  const accessTokenData = (await accessTokenResponse.json()) as Record<
    string,
    string
  >;
  if (!("access_token" in accessTokenData)) {
    console.log("access_token not in response");
    return "";
  }

  const { access_token, token_type } = accessTokenData;
  const userResponse = await fetch("https://api.github.com/user", {
    method: "GET",
    headers: {
      Authorization: `${token_type} ${access_token}`,
      "User-Agent": "GithubCopilot/1.133.0",
      Accept: "application/json",
    },
  });

  if (!userResponse.ok) {
    console.log("Failed to fetch user data");
    return "";
  }
  const userData = (await userResponse.json()) as { login: string };
  console.log(`login: ${userData.login},access_token: ${access_token}`);
  //const kv = await Deno.openKv();
  //await kv.set(["github_access_token"], access_token);
  return access_token;
}

async function githubRequestAuth(): Promise<AuthResponse> {
  const url = "https://github.com/login/device/code";
  const response = await fetch(url, {
    method: "POST",
    headers: LOGIN_HEADERS,
    body: JSON.stringify({
      client_id: "Iv1.b507a08c87ecfe98",
      scope: "read:user",
    }),
  });

  if (response.ok) {
    return (await response.json()) as AuthResponse;
  } else {
    throw new Error("Failed to fetch authentication data");
  }
}

export async function github(req: Request): Promise<Response> {
  const authReq = await githubRequestAuth();
  console.log(
    "Please visit",
    authReq["verification_uri"],
    "and enter",
    authReq["user_code"],
  );
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          `<p>Please visit <a href="${authReq["verification_uri"]}">${
            authReq["verification_uri"]
          }</a> and enter <code>${authReq["user_code"]}</code></p>`,
        ),
      );
      controller.enqueue(
        new TextEncoder().encode("<p>fetch access token... </p>"),
      );
      let ghToken = await checkGithubAuth(authReq["device_code"]);
      let access_token_count = 0;
      const interval = 1000 * authReq["interval"];
      while (!ghToken) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        ghToken = await checkGithubAuth(authReq["device_code"]);
        access_token_count += 1;
        if (access_token_count * interval > time_out) {
          break;
        }
      }
      if (!ghToken) {
        controller.enqueue(new TextEncoder().encode("<p>fetch timeout</p>"));
      } else {
        controller.enqueue(
          new TextEncoder().encode(`<p>token: <code>${ghToken}</code></p>`),
        );
      }
      // 标记数据结束
      controller.close();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}
