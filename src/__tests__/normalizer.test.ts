import { describe, it, expect, vi } from "vitest";
import {
  builtInNormalizer,
  mergeAppError,
  runNormalizerPipeline,
} from "../normalizer";
import type { AppError, Normalizer } from "../types";

describe("builtInNormalizer", () => {
  it("AbortError → returns null", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(builtInNormalizer(err, null)).toBeNull();
  });

  it("HTTP Response 404 with JSON body → correct AppError", async () => {
    // The built-in normalizer is sync — it uses status for code when body is unread
    const response = new Response(
      JSON.stringify({ code: "NOT_FOUND", message: "Not found" }),
      {
        status: 404,
        statusText: "Not Found",
      },
    );
    const result = builtInNormalizer(response, null);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(404);
    // sync fallback uses HTTP_404
    expect(result!.code).toBe("HTTP_404");
    expect(result!.raw).toBe(response);
  });

  it("HTTP Response 500 without parseable body → fallback code HTTP_500", () => {
    const response = new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
    const result = builtInNormalizer(response, null);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("HTTP_500");
    expect(result!.status).toBe(500);
  });

  it("Axios error with status 401 and data.code UNAUTHORIZED → correct AppError", () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 401,
        data: { code: "UNAUTHORIZED", message: "Unauthorized" },
      },
      config: {},
      message: "Request failed with status code 401",
    };
    const result = builtInNormalizer(axiosError, null);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("UNAUTHORIZED");
    expect(result!.status).toBe(401);
    expect(result!.raw).toBe(axiosError);
  });

  it("Structured object { code, message } → maps directly", () => {
    const structured = { code: "MY_ERROR", message: "oops" };
    const result = builtInNormalizer(structured, null);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("MY_ERROR");
    expect(result!.message).toBe("oops");
    expect(result!.raw).toBe(structured);
  });

  it("TypeError: Failed to fetch → code NETWORK_ERROR", () => {
    const err = new TypeError("Failed to fetch");
    const result = builtInNormalizer(err, null);
    expect(result).not.toBeNull();
    expect(result!.code).toBe("NETWORK_ERROR");
    expect(result!.raw).toBe(err);
  });

  it("Unknown string → returns null", () => {
    expect(builtInNormalizer("something weird", null)).toBeNull();
  });

  it("raw is always preserved in output .raw", () => {
    const err = new TypeError("network");
    const result = builtInNormalizer(err, null);
    expect(result!.raw).toBe(err);
  });
});

describe("runNormalizerPipeline", () => {
  it("no custom normalizers → built-in result", () => {
    const err = new TypeError("failed");
    const result = runNormalizerPipeline(err, [], builtInNormalizer);
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("custom normalizer returning partial merges with built-in (later keys win)", () => {
    const customNormalizer: Normalizer = (raw) => ({
      code: "CUSTOM",
      message: "custom message",
      raw,
    });
    const err = new TypeError("failed");
    const result = runNormalizerPipeline(
      err,
      [customNormalizer],
      builtInNormalizer,
    );
    // built-in runs after custom, overrides code with NETWORK_ERROR
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("custom normalizer returning null → accumulator unchanged", () => {
    const nullNormalizer: Normalizer = () => null;
    const err = new TypeError("failed");
    const result = runNormalizerPipeline(
      err,
      [nullNormalizer],
      builtInNormalizer,
    );
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("custom normalizer throwing → onError called, pipeline continues", () => {
    const onError = vi.fn();
    const throwingNormalizer: Normalizer = () => {
      throw new Error("boom");
    };
    const err = new TypeError("failed");
    const result = runNormalizerPipeline(
      err,
      [throwingNormalizer],
      builtInNormalizer,
      onError,
    );
    expect(onError).toHaveBeenCalledOnce();
    expect(result.code).toBe("NETWORK_ERROR");
  });

  it("full null result → synthesizes GRACEFULERRORS_UNHANDLED", () => {
    const nullNormalizer: Normalizer = () => null;
    const raw = "unknown input";
    const result = runNormalizerPipeline(raw, [nullNormalizer], () => null);
    expect(result.code).toBe("GRACEFULERRORS_UNHANDLED");
    expect(result.raw).toBe(raw);
  });

  it("result missing code → assigned GRACEFULERRORS_UNKNOWN", () => {
    const weirdNormalizer: Normalizer = (raw) =>
      ({ code: "" as string, raw }) as AppError;
    const result = runNormalizerPipeline("x", [weirdNormalizer], () => null);
    expect(result.code).toBe("GRACEFULERRORS_UNKNOWN");
  });
});

describe("mergeAppError", () => {
  it("undefined values never overwrite existing values", () => {
    const current: AppError = { code: "FOO", status: 400, message: "existing" };
    const partial: AppError = {
      code: "FOO",
      status: undefined,
      message: undefined,
      raw: "r",
    };
    const result = mergeAppError(current, partial);
    expect(result.status).toBe(400);
    expect(result.message).toBe("existing");
  });

  it("context is shallow-merged", () => {
    const current: AppError = {
      code: "FOO",
      context: { field: "email", extra: "keep" },
    };
    const partial: AppError = {
      code: "FOO",
      context: { field: "name", newKey: "added" },
    };
    const result = mergeAppError(current, partial);
    expect(result.context?.["field"]).toBe("name");
    expect(result.context?.["extra"]).toBe("keep");
    expect(result.context?.["newKey"]).toBe("added");
  });

  it("raw is never overwritten", () => {
    const originalRaw = { original: true };
    const current: AppError = { code: "FOO", raw: originalRaw };
    const partial: AppError = { code: "BAR", raw: { different: true } };
    const result = mergeAppError(current, partial);
    expect(result.raw).toBe(originalRaw);
  });
});
