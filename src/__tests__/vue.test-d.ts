import { expectType } from "tsd";
import type { Ref, Plugin } from "vue";
import { useErrorEngine, useFieldError, createErrorEnginePlugin } from "../vue";
import type { ErrorEngine, AppError } from "../types";

// useErrorEngine with custom code type
declare type MyCode = "AUTH_ERROR" | "NOT_FOUND";
declare type MyField = "email" | "password";

function runComposableTypeAssertions() {
  const engine = useErrorEngine<MyCode>();
  expectType<ErrorEngine<MyCode> | null>(engine);

  // useFieldError — valid field
  const { error } = useFieldError<MyField>("email");
  expectType<Ref<AppError<string, MyField> | null>>(error);

  // useFieldError — invalid field should produce TS error
  // @ts-expect-error: 'username' is not a valid MyField value
  useFieldError<MyField>("username");
}

runComposableTypeAssertions();

// createErrorEnginePlugin returns Plugin
declare const typedEngine: ErrorEngine<MyCode>;
const plugin = createErrorEnginePlugin(typedEngine);
expectType<Plugin>(plugin);
