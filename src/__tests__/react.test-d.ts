import { expectType } from "tsd";
import { useErrorEngine, useFieldError } from "../react";
import type { ErrorEngine } from "../types";

// useErrorEngine with custom code type
declare type MyCode = "AUTH_ERROR" | "NOT_FOUND";
declare type MyField = "email" | "password";

function useTypeAssertions() {
  const engine = useErrorEngine<MyCode>();
  expectType<ErrorEngine<MyCode> | null>(engine);

  // useFieldError — valid field
  const { error } = useFieldError<MyField>("email");
  expectType<import("../types").AppError<string, MyField> | null>(error);

  // useFieldError — invalid field should produce TS error
  // @ts-expect-error: 'username' is not a valid MyField value
  useFieldError<MyField>("username");
}

void useTypeAssertions;
