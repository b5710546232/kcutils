import { AsyncRunner, Commandline, Option } from "../..";

const option = new Option({ dirname: process.cwd(), input: process.argv.slice(2), transform: Option.transform });
const transformer = new AsyncRunner(option, async ({ helper, data }) => {
  if (data.arguments.publish) {
    const publishTo = data.arguments.publish;
    const name = helper.on("parent").projectName("dirname", false);

    helper.log.debug("Publish", `starting publish to ${publishTo}`);

    if (!helper.env.isCI()) {
      const answer = await helper.question.askBoolean("Are you sure to publish document to Github Pages?");
      if (!answer) return ["echo", `[skip] don't want to publish documents`];
    }

    if (publishTo === "github") {
      const ghpages = helper.path.nodeCommand("gh-pages");
      if (ghpages === undefined) return ["echo", "[skip] gh-pages command missing"];
      else
        return [
          ghpages,
          "--add",
          "--message",
          `chore(release): publish ${name} document [skip ci]`,
          "--dist",
          "docs",
          "--dest",
          name,
        ];
    } else {
      return ["echo", `unsupport publish to location: ${publishTo}`];
    }
  } else {
    const typedoc = helper.path.nodeCommand("typedoc");

    const project = helper.on("parent");

    const tsconfig = project.pathEnsureSync("tsconfig.json");
    const sourcecode = project.pathEnsureSync("src");
    const readme = project.pathEnsureSync("README.md") ?? "none";
    const result = project.path("docs");

    const args: string[] = [];

    if (typedoc === undefined) return ["echo", `[skip] typedoc command not exist`];
    else if (tsconfig === undefined) return ["echo", `[skip] tsconfig.json file is missing from ${project.pwd}`];
    else if (sourcecode === undefined) return ["echo", `[skip] ${project.path("src")} is missing`];
    args.push(
      typedoc,
      "--toc",
      "--mode",
      "modules",
      "--out",
      result,
      "--tsconfig",
      tsconfig,
      "--readme",
      readme,
      sourcecode
    );

    // pass other arguments to commandline
    args.push(...(data.arguments._ ?? []));

    return args;
  }
});

const cli = new Commandline(transformer);
cli.start();
