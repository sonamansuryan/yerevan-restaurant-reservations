import type { Request, Response } from "express";
import { expect, test, vi } from "vitest";

import { errorHandler } from "../src/middleware/errorHandler.ts";

test("an error after the reply has started closes the connection itself", () => {
  const next = vi.fn();
  const res = { headersSent: true, destroy: vi.fn() };
  const error = new Error("Too late");

  errorHandler(error, {} as Request, res as unknown as Response, next);

  // next(err) would reach Express's own handler, which prints the whole error with console.error.
  expect(next).not.toHaveBeenCalled();
  expect(res.destroy).toHaveBeenCalledOnce();
  expect(res).toMatchObject({ err: error });
});

test("a value that isn't an error is still recorded as one, for the log", () => {
  const res = { headersSent: true, destroy: vi.fn() };

  errorHandler("not an error", {} as Request, res as unknown as Response, vi.fn());

  expect((res as unknown as Response).err).toBeInstanceOf(Error);
});
