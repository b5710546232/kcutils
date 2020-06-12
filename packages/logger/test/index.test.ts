import { string } from "@kcutils/helper";

import { Logger } from "../src";
import { DateTimeFormat } from "../src/models/logger/LoggerOption";
import { error, warn, info, silly, silent, debug, toLevel, Levels } from "../src/constants/levels";
import { MockStream } from "../src/test/models/stream";
import { LoggerLevelBuilder } from "../src/models/logger/LoggerLevel";
import { DefaultKeyTypes } from "../src/constants/types";

const newMockStream = () => {
  const fn = jest.fn();
  const stream = new MockStream(fn);

  return { fn, stream };
};

const withCustomStream = (_logger: Logger) => {
  const s = newMockStream();
  const logger = _logger.copy({ streams: [s.stream], overrideStream: true });

  return { logger, stream: s.fn };
};

const getStreamChunk = (stream: jest.Mock<any, any>, times: number = 1) => {
  const length = stream.mock.calls.length;
  const _times = times > length ? length - 1 : times - 1;

  const buffer = stream.mock.calls[_times][0] as Buffer;
  return buffer.toString();
};

describe("logger modules", () => {
  test.each([
    ["error", error],
    ["warn", warn],
    ["info", info],
    ["debug", debug],
    ["silly", silly],
    ["silent", silent],
    ["not_found", info],
    ["", info],
  ])("convert %s to level %p", (input, expected) => {
    const l = toLevel(input);

    expect(l.name).toEqual(expected.name);
    expect(l.level).toEqual(expected.level);
  });

  describe("Logger object", () => {
    const def = new Logger();

    test("create default logger", () => {
      const logger = def.copy();

      expect(logger).not.toBeUndefined();

      expect(logger.isEnabled()).toEqual(true);
      expect(logger.isColor()).toEqual(true);
    });

    test("custom logger configuration", () => {
      const logger = def.copy({ color: false, disabled: true });

      expect(logger).not.toBeUndefined();

      expect(logger.isEnabled()).toEqual(false);
      expect(logger.isColor()).toEqual(false);
    });

    test("disable color on promise", () => {
      const logger = def.copy();

      expect(logger.isColor()).toEqual(true);

      logger.uncolor();
      expect(logger.isColor()).toEqual(false);

      logger.color();
      expect(logger.isColor()).toEqual(true);
    });

    test("getting levels", () => {
      const logger = def.copy();
      expect(logger.levels).not.toBeUndefined();
      expect(logger.levels.length).toBeGreaterThan(5);
    });

    test("default scopes name", () => {
      const logger = def.copy();
      expect(logger.scopes).toHaveLength(0);
    });

    test("add new scopes name", () => {
      const logger = def.copy({ scopes: ["name"] });
      expect(logger.scopes).toHaveLength(1);

      logger.options({ scopes: ["add", "more"] });
      expect(logger.scopes).toHaveLength(3);

      logger.unscope();
      expect(logger.scopes).toHaveLength(0);
    });

    test("new settings", () => {
      const a = withCustomStream(def.copy());
      const b = withCustomStream(def.copy());

      a.logger.settings({ message: { bold: true } }).print("success", "scope is bold");
      b.logger.settings({ seperator: { italic: true } }).print("success", "label is italic");

      const chunkA = getStreamChunk(a.stream);
      const chunkB = getStreamChunk(b.stream);

      // [20-06-12] → ♥  favorite  hello world
      expect(chunkA).not.toEqual(chunkB);
    });

    test("normal log message", () => {
      const logger = def.copy({ color: false, json: true });
      logger.print("note", "message");
    });

    test("log message to stream", () => {
      const { stream, logger } = withCustomStream(def);
      logger.print("fav", { message: "hello world" });

      expect(stream).toBeCalledTimes(1);

      const chunk = getStreamChunk(stream);
      // [20-06-12] → ♥  favorite  hello world
      expect(chunk).toContain("hello world");
      expect(chunk).toContain("favorite");

      logger.print("wait", "second called");
      expect(stream).toBeCalledTimes(2);
    });

    test("log custom label message", () => {
      const { stream, logger } = withCustomStream(def);

      logger.print("stop", { message: "custom label", label: "asdf" });

      const chunk = getStreamChunk(stream);
      expect(chunk).toContain("asdf");
    });

    test("log custom prefix message", () => {
      const { stream, logger } = withCustomStream(
        def.copy({}, { prefix: { prefix: "(", suffix: ")", uppercase: true } })
      );

      logger.print("success", { message: "custom prefix", prefix: "ald" });

      const chunk = getStreamChunk(stream);
      expect(chunk).toContain("(ALD)");
    });

    test("log custom suffix message", () => {
      const { stream, logger } = withCustomStream(def.copy({}, { suffix: { prefix: "{", suffix: "}" } }));

      logger.print("wait", { message: "custom suffix", suffix: "suf" });

      const chunk = getStreamChunk(stream);
      expect(chunk).toContain("{suf}");
    });

    test("override log stream on each print", () => {
      const stream = newMockStream();
      const _def = withCustomStream(def);
      _def.logger.print("fav", { message: "hello world" });
      _def.logger.print("fav", { message: "hello world" });

      _def.logger.print("fav", { message: "hello world", stream: stream.stream });

      expect(_def.stream).toBeCalledTimes(2);
      expect(stream.fn).toBeCalledTimes(1);
    });

    test("override log stream on each print by append", () => {
      const stream = newMockStream();
      const _def = withCustomStream(def);
      _def.logger.print("fav", { message: "hello world" });
      _def.logger.print("fav", { message: "hello world" });

      _def.logger.print("fav", { message: "hello world", stream: stream.stream, appendStream: true });

      expect(_def.stream).toBeCalledTimes(3);
      expect(stream.fn).toBeCalledTimes(1);
    });

    test("log same message should get same result", () => {
      const _logger = def.copy({ color: false });

      const d = withCustomStream(_logger);
      d.logger.print("note", { message: "hello world" });

      const e = withCustomStream(_logger);
      e.logger.print("note", "hello world");

      expect(d.stream).toBeCalledTimes(1);
      expect(e.stream).toBeCalledTimes(1);

      const chunk1 = getStreamChunk(d.stream);
      const chunk2 = getStreamChunk(e.stream);

      expect(chunk1).toEqual(chunk2);
    });

    describe.each([
      ["silly" as DefaultKeyTypes, "silly" as Levels, 1],
      ["debug" as DefaultKeyTypes, "silly" as Levels, 1],
      ["fav" as DefaultKeyTypes, "silly" as Levels, 1],
      ["wait" as DefaultKeyTypes, "silly" as Levels, 1],
      ["warn" as DefaultKeyTypes, "silly" as Levels, 1],
      ["error" as DefaultKeyTypes, "silly" as Levels, 1],

      ["silly" as DefaultKeyTypes, "debug" as Levels, 0],
      ["debug" as DefaultKeyTypes, "debug" as Levels, 1],
      ["success" as DefaultKeyTypes, "debug" as Levels, 1],
      ["star" as DefaultKeyTypes, "debug" as Levels, 1],
      ["warn" as DefaultKeyTypes, "debug" as Levels, 1],
      ["error" as DefaultKeyTypes, "debug" as Levels, 1],

      ["silly" as DefaultKeyTypes, "info" as Levels, 0],
      ["debug" as DefaultKeyTypes, "info" as Levels, 0],
      ["log" as DefaultKeyTypes, "info" as Levels, 1],
      ["info" as DefaultKeyTypes, "info" as Levels, 1],
      ["warn" as DefaultKeyTypes, "info" as Levels, 1],
      ["error" as DefaultKeyTypes, "info" as Levels, 1],

      ["silly" as DefaultKeyTypes, "warn" as Levels, 0],
      ["debug" as DefaultKeyTypes, "warn" as Levels, 0],
      ["await" as DefaultKeyTypes, "warn" as Levels, 0],
      ["pending" as DefaultKeyTypes, "warn" as Levels, 0],
      ["warn" as DefaultKeyTypes, "warn" as Levels, 1],
      ["error" as DefaultKeyTypes, "warn" as Levels, 1],

      ["silly" as DefaultKeyTypes, "error" as Levels, 0],
      ["debug" as DefaultKeyTypes, "error" as Levels, 0],
      ["watch" as DefaultKeyTypes, "error" as Levels, 0],
      ["info" as DefaultKeyTypes, "error" as Levels, 0],
      ["warn" as DefaultKeyTypes, "error" as Levels, 0],
      ["error" as DefaultKeyTypes, "error" as Levels, 1],
      ["fatal" as DefaultKeyTypes, "error" as Levels, 1],

      ["silly" as DefaultKeyTypes, "silent" as Levels, 0],
      ["debug" as DefaultKeyTypes, "silent" as Levels, 0],
      ["stop" as DefaultKeyTypes, "silent" as Levels, 0],
      ["success" as DefaultKeyTypes, "silent" as Levels, 0],
      ["warn" as DefaultKeyTypes, "silent" as Levels, 0],
      ["error" as DefaultKeyTypes, "silent" as Levels, 0],
      ["fatal" as DefaultKeyTypes, "silent" as Levels, 0],
    ])("run type($s) on level(%s) %s times", (type, level, expected) => {
      test("on print", () => {
        const message = { message: "hello world" };

        const { logger, stream } = withCustomStream(def.copy({ level }));
        logger.print(type, message);

        expect(stream).toBeCalledTimes(expected);
      });

      test("on build", () => {
        const message = { message: "hello world" };

        const logger = def.copy({ level });
        const msg = logger.build(type, message);

        if (expected === 0) expect(msg).toEqual("");
        else expect(msg).not.toEqual("");
      });
    });

    test.each([
      [{ color: false }, { color: true }],
      [{ json: true }, { json: false }],
      [{ datetime: "time" as DateTimeFormat }, { datetime: "date" as DateTimeFormat }],
      [{ datetime: "datetime" as DateTimeFormat }, { datetime: "timestamp" as DateTimeFormat }],
      [{ datetime: "unknown" as DateTimeFormat }, { datetime: "time" as DateTimeFormat }],
      [{ datetime: "unknown" as DateTimeFormat }, { datetime: "datetime" as DateTimeFormat }],
      [{ datetime: "unknown" as DateTimeFormat }, { datetime: "timestamp" as DateTimeFormat }],
      [{ scopes: [] }, { scopes: ["hello", "world"] }],
      [{ secrets: [] }, { secrets: ["world"] }],
      [{ separator: ">" }, {}],
    ])("difference config difference result (%p != %p)", (settingsA, settingsB) => {
      const type = "note";
      const message = { message: "hello world" };

      const d = withCustomStream(def.copy(settingsA));
      d.logger.print(type, message);

      const e = withCustomStream(def.copy(settingsB));
      e.logger.print(type, message);

      expect(d.stream).toBeCalledTimes(1);
      expect(e.stream).toBeCalledTimes(1);

      const chunk1 = getStreamChunk(d.stream);
      const chunk2 = getStreamChunk(e.stream);

      expect(chunk1).not.toEqual(chunk2);
    });

    test.each([
      [
        { secrets: ["hello", "new", "man"] },
        "hello, I'm become a new woman after I meet man like you",
        "[secure], I'm become a [secure] wo[secure] after I meet [secure] like you",
      ],
      [
        { secrets: ["hello", "new", "man"], censor: (s: string) => string.padEnd("", s.length, "*") },
        "hello, I'm become a new woman after I meet man like you",
        "[*****], I'm become a [***] wo[***] after I meet [***] like you",
      ],
      [
        {},
        "hello, I'm become a new woman after I meet man like you",
        "hello, I'm become a new woman after I meet man like you",
      ],
    ])("censor message with config %p", (settings, original, expected) => {
      const logger = def.copy(settings, { secret: { prefix: "[", suffix: "]" } });
      const censored = logger.censor(original);

      expect(censored).toEqual(expected);
    });

    test("start and end timer with default label", () => {
      const a = withCustomStream(def);

      a.logger.startTimer();
      expect(a.stream).toBeCalledTimes(1);
      expect(getStreamChunk(a.stream)).toContain("timer_0");

      a.logger.endTimer();
      expect(a.stream).toBeCalledTimes(2);
      expect(getStreamChunk(a.stream, 2)).toContain("timer_0");
    });

    test("start and end timer with custom label", () => {
      const label = "custom";
      const a = withCustomStream(def);

      a.logger.startTimer(label);
      expect(a.stream).toBeCalledTimes(1);
      expect(getStreamChunk(a.stream)).toContain(label);

      a.logger.endTimer(label);
      expect(a.stream).toBeCalledTimes(2);
      expect(getStreamChunk(a.stream, 2)).toContain(label);
    });

    test("end timer when no timer run", () => {
      const label = "custom";
      const a = withCustomStream(def);

      a.logger.endTimer(label);
      expect(a.stream).toBeCalledTimes(0);
    });

    test("remove all secret words", () => {
      const logger = def.copy({ secrets: ["data"] });

      const censored = logger.censor("new data");
      expect(censored).toEqual("new [secure]");

      logger.unsecret();

      const censored2 = logger.censor("new data");
      expect(censored2).toEqual("new data");
    });
  });

  describe("Logger level", () => {
    test("custom level stream", () => {
      const level = -1;
      const name = "custom";

      const mockWriteStreamFn = jest.fn();
      const mockStream = new MockStream(mockWriteStreamFn);

      const mockWriteStreamFn2 = jest.fn();
      const mockStream2 = new MockStream(mockWriteStreamFn2);

      const old = new LoggerLevelBuilder(level, name, mockStream);

      expect(old.level).toEqual(level);
      expect(old.name).toEqual(name);
      expect(old.stream).toEqual(mockStream);

      const newLevel = old.copy(mockStream2);

      expect(newLevel.level).toEqual(level);
      expect(newLevel.name).toEqual(name);
      expect(newLevel.stream).toEqual(mockStream2);
    });
  });
});
