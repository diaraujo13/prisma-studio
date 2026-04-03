import { sql } from "@codemirror/lang-sql";
import CodeMirror from "@uiw/react-codemirror";
import { Code2, Copy, Table2 } from "lucide-react";
import { useMemo, useState } from "react";

import type { Column, Schema, Table } from "../../../../data/adapter";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import { useIntrospection } from "../../../hooks/use-introspection";
import { useNavigation } from "../../../hooks/use-navigation";
import { useStudio } from "../../context";
import { StudioHeader } from "../../StudioHeader";
import type { ViewProps } from "../View";

/**
 * Generates a CREATE TABLE DDL statement from an introspected table.
 */
function generateCreateTableDdl(
  table: Table,
  dialect: "postgresql" | "mysql" | "sqlite",
): string {
  const columns = Object.values(table.columns);

  // Sort: PKs first, then the rest
  const sorted = [...columns].sort((a, b) => {
    if (a.pkPosition != null && b.pkPosition != null) {
      return a.pkPosition - b.pkPosition;
    }
    if (a.pkPosition != null) return -1;
    if (b.pkPosition != null) return 1;
    return 0;
  });

  const q = dialect === "mysql" ? "`" : '"';

  const columnLines = sorted.map((col) => {
    let def = `  ${q}${col.name}${q} ${col.datatype.name}`;

    if (col.isAutoincrement) {
      if (dialect === "postgresql") {
        def = `  ${q}${col.name}${q} SERIAL`;
      } else if (dialect === "mysql") {
        def += " AUTO_INCREMENT";
      } else {
        def += " AUTOINCREMENT";
      }
    }

    if (!col.nullable) {
      def += " NOT NULL";
    }

    if (col.defaultValue != null) {
      def += ` DEFAULT ${col.defaultValue}`;
    }

    return def;
  });

  // Primary key constraint
  const pkColumns = sorted
    .filter((col) => col.pkPosition != null)
    .sort((a, b) => (a.pkPosition ?? 0) - (b.pkPosition ?? 0));

  if (pkColumns.length > 0) {
    const pkCols = pkColumns.map((c) => `${q}${c.name}${q}`).join(", ");
    columnLines.push(`  PRIMARY KEY (${pkCols})`);
  }

  // Foreign key constraints
  const fkColumns = sorted.filter((col) => col.fkTable && col.fkColumn);
  for (const col of fkColumns) {
    if (!col.fkTable || !col.fkColumn) continue;
    const fkSchema = col.fkSchema ? `${q}${col.fkSchema}${q}.` : "";
    columnLines.push(
      `  FOREIGN KEY (${q}${col.name}${q}) REFERENCES ${fkSchema}${q}${col.fkTable}${q} (${q}${col.fkColumn}${q})`,
    );
  }

  const schemaPrefix = dialect !== "sqlite" ? `${q}${table.schema}${q}.` : "";
  return `CREATE TABLE ${schemaPrefix}${q}${table.name}${q} (\n${columnLines.join(",\n")}\n);`;
}

/**
 * Generates a description for a column used as a tooltip.
 */
function getColumnDescription(col: Column): string {
  const parts: string[] = [`Type: ${col.datatype.name}`];
  if (col.pkPosition != null) parts.push("Primary key");
  if (col.fkTable) parts.push(`Foreign key → ${col.fkTable}.${col.fkColumn}`);
  if (col.nullable) parts.push("Nullable");
  if (col.isAutoincrement) parts.push("Auto-increment");
  if (col.defaultValue) parts.push(`Default: ${col.defaultValue}`);
  return parts.join(" · ");
}

export function DdlView(_props: ViewProps) {
  const { adapter, isDarkMode } = useStudio();
  const { data: introspection } = useIntrospection();
  const {
    metadata: { activeSchema },
  } = useNavigation();

  const dialect = adapter.capabilities?.sqlDialect ?? "postgresql";

  const currentSchemaData: Schema | undefined = useMemo(() => {
    if (!introspection || !activeSchema) return undefined;
    return introspection.schemas[activeSchema.name];
  }, [introspection, activeSchema]);

  const tableNames = useMemo(
    () =>
      currentSchemaData
        ? Object.keys(currentSchemaData.tables).sort((a, b) =>
            a.localeCompare(b),
          )
        : [],
    [currentSchemaData],
  );

  const [selectedTableName, setSelectedTableName] = useState<string>(() => {
    return tableNames[0] ?? "";
  });

  // Ensure selectedTableName stays valid when schema changes
  const effectiveTableName =
    tableNames.includes(selectedTableName) || selectedTableName === ""
      ? selectedTableName
      : (tableNames[0] ?? "");

  const selectedTable = useMemo(() => {
    if (!currentSchemaData || !effectiveTableName) return null;
    return currentSchemaData.tables[effectiveTableName] ?? null;
  }, [currentSchemaData, effectiveTableName]);

  const ddl = useMemo(() => {
    if (!selectedTable) return "";
    return generateCreateTableDdl(selectedTable, dialect);
  }, [selectedTable, dialect]);

  const allDdl = useMemo(() => {
    if (!currentSchemaData) return "";
    return Object.values(currentSchemaData.tables)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => generateCreateTableDdl(t, dialect))
      .join("\n\n");
  }, [currentSchemaData, dialect]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback – silently ignore on non-secure contexts
    }
  }

  const headerContent = (
    <div className="flex items-center gap-2 flex-1">
      <Code2 className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">DDL Editor</span>
    </div>
  );

  const headerEndContent = (
    <div className="flex items-center gap-2">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void copyToClipboard(allDdl)}
              disabled={!allDdl}
            >
              <Copy className="size-4" />
              Copy all DDL
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy DDL for all tables in the schema</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col h-full overflow-hidden">
      <StudioHeader endContent={headerEndContent}>{headerContent}</StudioHeader>

      <div className="flex flex-col gap-3 p-3 border-b border-border bg-background">
        <div className="flex items-center gap-3">
          <Table2 className="size-4 text-muted-foreground shrink-0" />
          <Select
            value={effectiveTableName}
            onValueChange={setSelectedTableName}
          >
            <SelectTrigger className="w-64 text-xs" label="Table">
              <SelectValue placeholder="Select a table" />
            </SelectTrigger>
            <SelectContent>
              {tableNames.length > 0 ? (
                tableNames.map((name) => (
                  <SelectItem
                    key={name}
                    value={name}
                    className="text-xs font-mono"
                  >
                    {name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="" disabled>
                  No tables found
                </SelectItem>
              )}
            </SelectContent>
          </Select>

          {ddl && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void copyToClipboard(ddl)}
                  >
                    <Copy className="size-4" />
                    Copy DDL
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Copy the CREATE TABLE statement for this table
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {selectedTable && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">
              {selectedTable.columns
                ? Object.keys(selectedTable.columns).length
                : 0}
            </span>{" "}
            column
            {Object.keys(selectedTable.columns ?? {}).length !== 1 ? "s" : ""}
            {" · "}
            <TooltipProvider delayDuration={200}>
              {Object.values(selectedTable.columns).map((col) => (
                <Tooltip key={col.name}>
                  <TooltipTrigger asChild>
                    <span className="inline-block font-mono cursor-default underline decoration-dotted mr-1.5">
                      {col.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{getColumnDescription(col)}</TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>
        )}
      </div>

      <div className="grow min-h-0 overflow-auto p-3">
        {ddl ? (
          <div className="rounded-md border border-border overflow-hidden bg-background">
            <CodeMirror
              aria-label="DDL editor"
              basicSetup={{ foldGutter: false, lineNumbers: true }}
              className={[
                "[&_.cm-editor]:!border-0 [&_.cm-editor]:font-mono",
                "[&_.cm-gutters]:border-r [&_.cm-gutters]:border-border [&_.cm-gutters]:bg-muted/30",
                "[&_.cm-line]:text-[15px] [&_.cm-scroller]:font-mono",
              ].join(" ")}
              extensions={[sql()]}
              readOnly
              theme={isDarkMode ? "dark" : "light"}
              value={ddl}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            {tableNames.length === 0
              ? "No tables found in this schema."
              : "Select a table to view its DDL."}
          </div>
        )}
      </div>
    </div>
  );
}
