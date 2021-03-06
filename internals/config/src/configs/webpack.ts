import { Configuration, RuleSetRule, ProvidePlugin, Plugin, ExternalsElement } from "webpack";

import { ConfigBuilder } from "../models/ConfigBuilder";
import { Config } from "../models/Config";

type Mode = "production" | "development" | "none";
type Target = "node" | "web";

const defaultConfig = {
  /**
   * webpack mode production / development / none
   * @default production
   */
  mode: "production" as Mode,
  /**
   * add config to support react
   * @default false
   */
  react: false,
  /**
   * add config to support eslint and prettier
   * @default true
   */
  lint: true,
  /**
   * custom index file to run
   * @default index.ts and index.tsx for react
   */
  index: "",
  /**
   * custom library name
   * @default <folder_name> this will get data from package name
   */
  output: "",

  target: "" as Target,
};

type Options = Partial<typeof defaultConfig>;

const webpack: ConfigBuilder<Options, Configuration> = {
  default: defaultConfig,
  transformer: ({ helper, data }) => {
    const base = helper.on("parent").projectName();

    const autoDetect: Options = {};
    autoDetect.react = helper.on("parent").searchPackageJsonSync("dependencies", "react");
    autoDetect.index =
      helper.on("parent").pathEnsureSync("src", "index.ts") ?? helper.on("parent").pathEnsureSync("src", "index.tsx");

    const options = helper.general.byDefault(defaultConfig, autoDetect, data);

    const tsconfig = helper.on("parent").path("tsconfig.json");

    const target = helper.general.getOrElse(options.target, options.react ? "web" : "node");
    const index = helper.general.getOrElse(options.index, options.react ? "index.tsx" : "index.ts");
    const library = helper.general.getOrElse(options.output, base);

    const rules: RuleSetRule[] = [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: [/node_modules/, /lib/, /test/, /\.test\.ts/, /\.spec\.ts/],
        options: { configFile: tsconfig },
      },
    ];

    const plugins: Plugin[] = [];
    const externals: ExternalsElement[] = [];

    const eslint = helper.on("parent").pathEnsureSync(".eslintrc.js");
    if (options.lint && eslint !== undefined) {
      const report = helper.on("parent").path("eslint.xml");

      rules.unshift({
        enforce: "pre",
        test: /\.tsx?$/,
        loader: "eslint-loader",
        exclude: [/node_modules/, /lib/, /test/],
        options: {
          failOnError: true,
          cache: true,
          configFile: eslint,
          outputReport: {
            filePath: report,
          },
        },
      });
    }

    if (options.react) {
      plugins.push(
        new ProvidePlugin({
          // eslint-disable-next-line @typescript-eslint/naming-convention
          React: "React",
          react: "React",
          "window.react": "React",
          "window.React": "React",
        })
      );

      externals.push({
        react: {
          root: "React",
          umd: "React",
          commonjs: "react",
          commonjs2: "react",
        },
        "prop-types": {
          root: "PropTypes",
          umd: "PropTypes",
          commonjs: "prop-types",
          commonjs2: "prop-types",
        },
        "react-dom": {
          root: "ReactDOM",
          umd: "ReactDOM",
          commonjs: "react-dom",
          commonjs2: "react-dom",
        },
        "react-dom/server": {
          root: "ReactDOMServer",
          umd: "ReactDOMServer",
          commonjs: "react-dom/server",
          commonjs2: "react-dom/server",
        },
      });
    }

    return {
      mode: options.mode,
      target,
      entry: {
        index: helper.on("parent").path("src", index),
      },
      devtool: "source-map",
      output: {
        path: helper.on("parent").path("lib"),
        filename: "[name].js",
        library,
        libraryTarget: "umd",
      },
      module: {
        rules,
        noParse: [/react/, /prop-types/],
      },
      resolve: {
        extensions: [".tsx", ".ts", ".js", ".jsx", "json"],
      },
      plugins,
      externals,
    };
  },
};

export default (dir?: string, input?: Options): Config<Partial<Options>, Configuration> =>
  new Config(webpack, input, dir);
