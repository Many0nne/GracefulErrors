import { expectType, expectAssignable } from "tsd";
import type {
  AppError,
  HandleResult,
  ErrorEngineConfig,
  RoutingStrategy,
  UIAction,
} from "../types";

// AppError without generics defaults to string for both TCode and TField
declare const appError: AppError;
expectAssignable<{
  code: string;
  context?: { field?: string; [key: string]: unknown };
}>(appError);

// HandleResult.uiAction is UIAction | null
declare const result: HandleResult;
expectType<UIAction | null>(result.uiAction);

// ErrorEngineConfig.fallback.ui does not include 'inline'
type FallbackUI = NonNullable<ErrorEngineConfig["fallback"]>["ui"];
expectType<"toast" | "modal" | "silent">({} as FallbackUI);

// RoutingStrategy return type is UIAction | null
type StrategyReturn = ReturnType<RoutingStrategy>;
expectType<UIAction | null>({} as StrategyReturn);
