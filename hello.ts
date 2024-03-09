import Person, { sayHello } from "./mod.ts";
import chalk from "chalk";
import { load } from "https://deno.land/std@0.219.0/dotenv/mod.ts";
const ada: Person = {
  lastName: "Lovelace",
  firstName: "Ada",
};
console.log(chalk.green("Hello from Deno!"));
console.log(sayHello(ada));
console.log(Deno.env.get("PATH"));
const env = await load();
console.log(env["PASSWORD"]);
