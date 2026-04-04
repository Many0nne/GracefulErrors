import { expectType, expectError } from 'tsd'
import type { Ref } from 'vue'
import type { Plugin } from 'vue'
import { useErrorEngine, useFieldError, createErrorEnginePlugin } from '../vue'
import type { ErrorEngine, AppError } from '../types'

// useErrorEngine with custom code type
declare type MyCode = 'AUTH_ERROR' | 'NOT_FOUND'
const engine = useErrorEngine<MyCode>()
expectType<ErrorEngine<MyCode> | null>(engine)

// useFieldError — valid field
declare type MyField = 'email' | 'password'
const { error } = useFieldError<MyField>('email')
expectType<Ref<AppError<string, MyField> | null>>(error)

// useFieldError — invalid field should produce TS error
// @ts-expect-error
useFieldError<MyField>('username')

// createErrorEnginePlugin returns Plugin
declare const typedEngine: ErrorEngine<MyCode>
const plugin = createErrorEnginePlugin(typedEngine)
expectType<Plugin>(plugin)
