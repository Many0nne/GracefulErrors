import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createSentryReporter,
  createDatadogReporter,
  createWebhookReporter,
} from "../reporters/index";
import { createErrorEngine } from "../engine";
import type { AppError, ReporterContext } from "../types";
import type { SentryLike, DatadogRumLike } from "../reporters/index";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError<TCode extends string = string>(
  overrides: Partial<AppError<TCode>> = {},
): AppError<TCode> {
  return {
    code: "TEST_ERR" as TCode,
    status: 400,
    message: "Test error",
    raw: new Error("raw"),
    ...overrides,
  };
}

function makeContext<TCode extends string = string>(
  overrides: Partial<ReporterContext<TCode>> = {},
): ReporterContext<TCode> {
  return {
    result: {
      handled: true,
      uiAction: "toast",
      error: makeError<TCode>(),
    },
    fingerprint: "TEST_ERR:400:",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createSentryReporter
// ---------------------------------------------------------------------------

describe("createSentryReporter", () => {
  let sentry: SentryLike;

  beforeEach(() => {
    sentry = { captureException: vi.fn().mockReturnValue("event-id") };
  });

  it("calls captureException with built-in tags and extra", () => {
    const reporter = createSentryReporter(sentry);
    const error = makeError({ status: 500, code: "SERVER_ERR" as string });
    const ctx = makeContext({ fingerprint: "SERVER_ERR:500:" });

    reporter(error, ctx);

    expect(sentry.captureException).toHaveBeenCalledWith(error.raw, {
      level: "error",
      tags: {
        "gracefulerrors.code": "SERVER_ERR",
        "gracefulerrors.status": 500,
        "gracefulerrors.fingerprint": "SERVER_ERR:500:",
      },
      extra: {
        code: "SERVER_ERR",
        status: 500,
        message: error.message,
        context: error.context,
      },
      fingerprint: ["SERVER_ERR:500:"],
    });
  });

  it("uses raw error when error.raw is available", () => {
    const raw = new Error("original");
    const reporter = createSentryReporter(sentry);
    reporter(makeError({ raw }), makeContext());
    expect(
      (sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe(raw);
  });

  it("falls back to the AppError object when raw is absent", () => {
    const reporter = createSentryReporter(sentry);
    const error = makeError({ raw: undefined });
    reporter(error, makeContext());
    expect(
      (sentry.captureException as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe(error);
  });

  it("maps status < 500 to 'warning' by default", () => {
    const reporter = createSentryReporter(sentry);
    reporter(makeError({ status: 400 }), makeContext());
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: "warning" }),
    );
  });

  it("maps status >= 500 to 'error' by default", () => {
    const reporter = createSentryReporter(sentry);
    reporter(makeError({ status: 503 }), makeContext());
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: "error" }),
    );
  });

  it("maps missing status to 'error' by default", () => {
    const reporter = createSentryReporter(sentry);
    reporter(makeError({ status: undefined }), makeContext());
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: "error" }),
    );
  });

  it("uses custom level function", () => {
    const reporter = createSentryReporter(sentry, { level: () => "fatal" });
    reporter(makeError({ status: 200 }), makeContext());
    expect(sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ level: "fatal" }),
    );
  });

  it("merges custom tags", () => {
    const reporter = createSentryReporter(sentry, {
      tags: () => ({ "app.team": "backend" }),
    });
    reporter(makeError(), makeContext());
    const call = (sentry.captureException as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(call.tags["app.team"]).toBe("backend");
    expect(call.tags["gracefulerrors.code"]).toBeDefined();
  });

  it("skips ignored codes", () => {
    const reporter = createSentryReporter(sentry, { ignore: ["TEST_ERR"] });
    reporter(makeError({ code: "TEST_ERR" }), makeContext());
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("skips when handledOnly and result is not handled", () => {
    const reporter = createSentryReporter(sentry, { handledOnly: true });
    const ctx = makeContext({
      result: { handled: false, reason: "deduped", error: makeError() },
    });
    reporter(makeError(), ctx);
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("reports when handledOnly and result is handled", () => {
    const reporter = createSentryReporter(sentry, { handledOnly: true });
    reporter(makeError(), makeContext());
    expect(sentry.captureException).toHaveBeenCalled();
  });

  it("skips when action not in allowed actions list", () => {
    const reporter = createSentryReporter(sentry, { actions: ["modal"] });
    reporter(
      makeError(),
      makeContext({
        result: { handled: true, uiAction: "toast", error: makeError() },
      }),
    );
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("reports when action is in allowed actions list", () => {
    const reporter = createSentryReporter(sentry, { actions: ["toast"] });
    reporter(makeError(), makeContext());
    expect(sentry.captureException).toHaveBeenCalled();
  });

  it("skips when status below range min", () => {
    const reporter = createSentryReporter(sentry, {
      statusRange: { min: 500 },
    });
    reporter(makeError({ status: 400 }), makeContext());
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("reports when status within range", () => {
    const reporter = createSentryReporter(sentry, {
      statusRange: { min: 400, max: 599 },
    });
    reporter(makeError({ status: 500 }), makeContext());
    expect(sentry.captureException).toHaveBeenCalled();
  });

  it("skips when custom filter returns false", () => {
    const reporter = createSentryReporter(sentry, { filter: () => false });
    reporter(makeError(), makeContext());
    expect(sentry.captureException).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createDatadogReporter
// ---------------------------------------------------------------------------

describe("createDatadogReporter", () => {
  let datadogRum: DatadogRumLike;

  beforeEach(() => {
    datadogRum = { addError: vi.fn() };
  });

  it("calls addError with built-in context", () => {
    const reporter = createDatadogReporter(datadogRum);
    const error = makeError({ status: 400, code: "DD_ERR" as string });
    const ctx = makeContext({ fingerprint: "DD_ERR:400:" });

    reporter(error, ctx);

    expect(datadogRum.addError).toHaveBeenCalledWith(error.raw, {
      "gracefulerrors.code": "DD_ERR",
      "gracefulerrors.status": 400,
      "gracefulerrors.fingerprint": "DD_ERR:400:",
      "gracefulerrors.message": error.message,
    });
  });

  it("merges custom context", () => {
    const reporter = createDatadogReporter(datadogRum, {
      context: () => ({ "app.version": "1.2.3" }),
    });
    reporter(makeError(), makeContext());
    const call = (datadogRum.addError as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(call["app.version"]).toBe("1.2.3");
  });

  it("skips ignored codes", () => {
    const reporter = createDatadogReporter(datadogRum, {
      ignore: ["TEST_ERR"],
    });
    reporter(makeError({ code: "TEST_ERR" }), makeContext());
    expect(datadogRum.addError).not.toHaveBeenCalled();
  });

  it("skips when status out of range", () => {
    const reporter = createDatadogReporter(datadogRum, {
      statusRange: { min: 500 },
    });
    reporter(makeError({ status: 404 }), makeContext());
    expect(datadogRum.addError).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createWebhookReporter
// ---------------------------------------------------------------------------

describe("createWebhookReporter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("POSTs default payload to the configured URL", async () => {
    const reporter = createWebhookReporter({
      url: "https://example.com/errors",
    });
    const error = makeError({ code: "WH_ERR" as string, status: 503 });
    const ctx = makeContext({
      fingerprint: "WH_ERR:503:",
      result: { handled: true, uiAction: "toast", error },
    });

    await reporter(error, ctx);

    expect(fetch).toHaveBeenCalledWith("https://example.com/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "WH_ERR",
        status: 503,
        message: error.message,
        fingerprint: "WH_ERR:503:",
        uiAction: "toast",
      }),
    });
  });

  it("uses PUT when configured", async () => {
    const reporter = createWebhookReporter({
      url: "https://example.com/errors",
      method: "PUT",
    });
    await reporter(makeError(), makeContext());
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].method).toBe(
      "PUT",
    );
  });

  it("merges extra headers", async () => {
    const reporter = createWebhookReporter({
      url: "https://example.com/errors",
      headers: { Authorization: "Bearer tok" },
    });
    await reporter(makeError(), makeContext());
    const headers = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1]
      .headers;
    expect(headers["Authorization"]).toBe("Bearer tok");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("uses custom body function", async () => {
    const reporter = createWebhookReporter({
      url: "https://example.com/errors",
      body: (err) => ({ myCode: err.code }),
    });
    await reporter(makeError({ code: "CUSTOM" as string }), makeContext());
    const body = JSON.parse(
      (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    expect(body).toEqual({ myCode: "CUSTOM" });
  });

  it("skips ignored codes", async () => {
    const reporter = createWebhookReporter({
      url: "https://example.com/errors",
      ignore: ["TEST_ERR"],
    });
    await reporter(makeError({ code: "TEST_ERR" }), makeContext());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips when custom filter returns false", async () => {
    const reporter = createWebhookReporter({
      url: "https://example.com/errors",
      filter: () => false,
    });
    await reporter(makeError(), makeContext());
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Engine integration — reporters wired via config.reporters
// ---------------------------------------------------------------------------

describe("engine integration — reporters", () => {
  it("runs all reporters after handle()", async () => {
    const r1 = vi.fn();
    const r2 = vi.fn();

    const engine = createErrorEngine({
      registry: { TEST_ERR: { ui: "toast", message: "test" } },
      reporters: [r1, r2],
    });

    engine.handle({ code: "TEST_ERR", status: 400 });

    // reporters are fired async; flush microtask queue
    await Promise.resolve();

    expect(r1).toHaveBeenCalledTimes(1);
    expect(r2).toHaveBeenCalledTimes(1);
  });

  it("passes the fingerprint and result to reporters", async () => {
    const reporter = vi.fn();

    const engine = createErrorEngine({
      registry: { TEST_ERR: { ui: "toast" } },
      reporters: [reporter],
    });

    engine.handle({ code: "TEST_ERR", status: 400 });
    await Promise.resolve();

    const [, ctx] = reporter.mock.calls[0] as [AppError, ReporterContext];
    expect(typeof ctx.fingerprint).toBe("string");
    expect(ctx.fingerprint.length).toBeGreaterThan(0);
    expect(ctx.result.handled).toBe(true);
  });

  it("also runs reporters for suppressed/deduped errors", async () => {
    const reporter = vi.fn();

    const engine = createErrorEngine({
      registry: {},
      dedupeWindow: 5000,
      reporters: [reporter],
    });

    engine.handle({ code: "DUP_ERR", status: 400 });
    engine.handle({ code: "DUP_ERR", status: 400 }); // deduped
    await Promise.resolve();

    expect(reporter).toHaveBeenCalledTimes(2);
    const [, ctx2] = reporter.mock.calls[1] as [AppError, ReporterContext];
    expect(ctx2.result.handled).toBe(false);
    expect((ctx2.result as { reason: string }).reason).toBe("deduped");
  });

  it("does not crash the engine when a reporter throws", async () => {
    const badReporter = vi.fn().mockRejectedValue(new Error("reporter boom"));
    const goodReporter = vi.fn();

    const engine = createErrorEngine({
      registry: { TEST_ERR: { ui: "toast" } },
      reporters: [badReporter, goodReporter],
    });

    // handle must not throw
    expect(() => engine.handle({ code: "TEST_ERR" })).not.toThrow();

    await new Promise((r) => setTimeout(r, 0));

    expect(goodReporter).toHaveBeenCalled();
  });
});
