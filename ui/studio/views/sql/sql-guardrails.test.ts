import { describe, expect, it } from "vitest";

import { isSqlWriteOperation } from "./sql-guardrails";

describe("isSqlWriteOperation", () => {
  it("returns false for SELECT statements", () => {
    expect(isSqlWriteOperation("select * from users")).toBe(false);
    expect(isSqlWriteOperation("SELECT id, name FROM orders")).toBe(false);
    expect(isSqlWriteOperation("  SELECT 1  ")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isSqlWriteOperation("")).toBe(false);
    expect(isSqlWriteOperation("   ")).toBe(false);
  });

  it("returns true for INSERT", () => {
    expect(
      isSqlWriteOperation("INSERT INTO users (name) VALUES ('Alice')"),
    ).toBe(true);
    expect(isSqlWriteOperation("insert into t values (1)")).toBe(true);
  });

  it("returns true for UPDATE", () => {
    expect(
      isSqlWriteOperation("UPDATE users SET name = 'Bob' WHERE id = 1"),
    ).toBe(true);
    expect(isSqlWriteOperation("update orders set status='done'")).toBe(true);
  });

  it("returns true for DELETE", () => {
    expect(isSqlWriteOperation("DELETE FROM users WHERE id = 1")).toBe(true);
    expect(isSqlWriteOperation("delete from orders")).toBe(true);
  });

  it("returns true for DROP", () => {
    expect(isSqlWriteOperation("DROP TABLE users")).toBe(true);
    expect(isSqlWriteOperation("drop database mydb")).toBe(true);
  });

  it("returns true for TRUNCATE", () => {
    expect(isSqlWriteOperation("TRUNCATE TABLE users")).toBe(true);
    expect(isSqlWriteOperation("truncate orders")).toBe(true);
  });

  it("returns true for ALTER", () => {
    expect(isSqlWriteOperation("ALTER TABLE users ADD COLUMN email TEXT")).toBe(
      true,
    );
    expect(isSqlWriteOperation("alter table t drop column c")).toBe(true);
  });

  it("returns true for CREATE", () => {
    expect(isSqlWriteOperation("CREATE TABLE new_table (id INT)")).toBe(true);
    expect(isSqlWriteOperation("create index idx on t(col)")).toBe(true);
  });

  it("returns true for MERGE / REPLACE / UPSERT", () => {
    expect(isSqlWriteOperation("MERGE INTO target USING source")).toBe(true);
    expect(isSqlWriteOperation("REPLACE INTO t VALUES (1, 'x')")).toBe(true);
    expect(isSqlWriteOperation("UPSERT INTO t VALUES (1, 'y')")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSqlWriteOperation("Delete From users")).toBe(true);
    expect(isSqlWriteOperation("sElEcT 1")).toBe(false);
  });

  it("handles leading whitespace", () => {
    expect(isSqlWriteOperation("\n  DROP TABLE t")).toBe(true);
    expect(isSqlWriteOperation("\t select 1")).toBe(false);
  });
});
