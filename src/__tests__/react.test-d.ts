import { expectType, expectError } from 'tsd'
import { useErrorEngine, useFieldError } from '../react'
import type { ErrorEngine } from '../types'

// useErrorEngine with custom code type
declare type MyCode = 'AUTH_ERROR' | 'NOT_FOUND'
const engine = useErrorEngine<MyCode>()
expectType<ErrorEngine<MyCode> | null>(engine)

// useFieldError — valid field
declare type MyField = 'email' | 'password'
const { error } = useFieldError<MyField>('email')
expectType<import('../types').AppError<string, MyField> | null>(error)

// useFieldError — invalid field should produce TS error
// @ts-expect-error
useFieldError<MyField>('username')
