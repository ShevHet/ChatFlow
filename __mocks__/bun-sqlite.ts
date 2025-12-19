type Row = Record<string, any>;

class Statement {
  private db: Database;
  private sql: string;

  constructor(db: Database, sql: string) {
    this.db = db;
    this.sql = sql.trim();
  }

  run(...args: any[]) {
    const upper = this.sql.toUpperCase();

    if (upper.startsWith("INSERT INTO THREADS")) {
      const [title, createdAt = Math.floor(Date.now() / 1000)] = args;
      const row = { id: this.db.nextId("threads"), title, createdAt };
      this.db.table("threads").push(row);
      return { lastInsertRowid: row.id, changes: 1 };
    }

    if (upper.startsWith("INSERT INTO MESSAGES")) {
      const [threadId, sender, message, timestamp = Math.floor(Date.now() / 1000)] = args;
      const row = { id: this.db.nextId("messages"), threadId, sender, message, timestamp };
      this.db.table("messages").push(row);
      return { lastInsertRowid: row.id, changes: 1 };
    }

    if (upper.startsWith("INSERT INTO EXCEL_FILES")) {
      const [filename, size, rowCount, columnCount, headers] = args;
      const row = {
        id: this.db.nextId("excel_files"),
        filename,
        size,
        row_count: rowCount,
        column_count: columnCount,
        headers,
        uploaded_at: Math.floor(Date.now() / 1000),
      };
      this.db.table("excel_files").push(row);
      return { lastInsertRowid: row.id, changes: 1 };
    }

    if (upper.startsWith("INSERT INTO EXCEL_DATA")) {
      const [fileId, rowIndex, data] = args;
      const row = {
        id: this.db.nextId("excel_data"),
        file_id: fileId,
        row_index: rowIndex,
        data,
      };
      this.db.table("excel_data").push(row);
      return { lastInsertRowid: row.id, changes: 1 };
    }

    if (upper.startsWith("INSERT INTO MIGRATIONS")) {
      const [version, name, appliedAt = Math.floor(Date.now() / 1000)] = args;
      const row = {
        id: this.db.nextId("migrations"),
        version,
        name,
        applied_at: appliedAt,
      };
      this.db.table("migrations").push(row);
      return { lastInsertRowid: row.id, changes: 1 };
    }

    if (upper.startsWith("UPDATE EXCEL_DATA SET DATA")) {
      const [data, id] = args;
      const table = this.db.table("excel_data");
      const row = table.find((r) => r.id === id);
      if (row) {
        row.data = data;
        return { lastInsertRowid: id, changes: 1 };
      }
      return { lastInsertRowid: id, changes: 0 };
    }

    if (upper.startsWith("UPDATE EXCEL_FILES SET")) {
      const [filename, size, rowCount, columnCount, headers, id] = args;
      const table = this.db.table("excel_files");
      const row = table.find((r) => r.id === id);
      if (row) {
        row.filename = filename;
        row.size = size;
        row.row_count = rowCount;
        row.column_count = columnCount;
        row.headers = headers;
        return { lastInsertRowid: id, changes: 1 };
      }
      return { lastInsertRowid: id, changes: 0 };
    }

    if (upper.startsWith("DELETE FROM EXCEL_FILES")) {
      const [id] = args;
      const table = this.db.table("excel_files");
      const initialLength = table.length;
      const nextFiles = table.filter((r) => r.id !== id);
      this.db.setTable("excel_files", nextFiles);
      if (id !== undefined) {
        this.db.setTable(
          "excel_data",
          this.db.table("excel_data").filter((r) => r.file_id !== id)
        );
      }
      return { lastInsertRowid: 0, changes: initialLength - nextFiles.length };
    }

    if (upper.startsWith("DELETE FROM THREADS")) {
      const [id] = args;
      const table = this.db.table("threads");
      const initialLength = table.length;
      const nextThreads = id === undefined ? [] : table.filter((r) => r.id !== id);
      this.db.setTable("threads", nextThreads);
      if (id !== undefined) {
        this.db.setTable(
          "messages",
          this.db.table("messages").filter((r) => r.threadId !== id)
        );
      }
      return { lastInsertRowid: 0, changes: initialLength - nextThreads.length };
    }

    if (upper.startsWith("DELETE FROM MESSAGES")) {
      const [id] = args;
      const table = this.db.table("messages");
      const initialLength = table.length;
      this.db.setTable(
        "messages",
        id === undefined ? [] : table.filter((r) => r.id !== id)
      );
      return { lastInsertRowid: 0, changes: initialLength - this.db.table("messages").length };
    }

    if (upper.startsWith("DELETE FROM MIGRATIONS")) {
      const table = this.db.table("migrations");
      const initialLength = table.length;
      if (upper.includes("WHERE VERSION")) {
        const [version] = args;
        this.db.setTable(
          "migrations",
          table.filter((r) => r.version !== version)
        );
      } else {
        this.db.setTable("migrations", []);
      }
      return { lastInsertRowid: 0, changes: initialLength - this.db.table("migrations").length };
    }

    return { lastInsertRowid: 0, changes: 0 };
  }

  all(...args: any[]): Row[] {
    const upper = this.sql.toUpperCase();

    if (upper.includes("FROM SQLITE_MASTER")) {
      const typeMatch = this.sql.match(/type\s*=\s*'(\w+)'/i);
      const nameMatch = this.sql.match(/name\s*=\s*'([^']+)'/i);
      const likeMatch = this.sql.match(/name\s+LIKE\s+'([^']+)'/i);

      if (typeMatch && typeMatch[1].toLowerCase() === "table") {
        if (nameMatch) {
          const name = nameMatch[1];
          return this.db.hasTable(name) ? [{ name }] : [];
        }
        return this.db.tablesList().map((name) => ({ name }));
      }

      if (typeMatch && typeMatch[1].toLowerCase() === "index") {
        const indexes = this.db.indexes();
        if (likeMatch) {
          const pattern = likeMatch[1].replace(/%/g, "");
          return indexes.filter((i) => i.includes(pattern)).map((name) => ({ name }));
        }
        return indexes.map((name) => ({ name }));
      }
    }

    if (upper.includes("FROM THREADS")) {
      const rows = [...this.db.table("threads")];
      if (upper.includes("ORDER BY CREATEDAT DESC")) {
        rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      }
      return rows;
    }

    if (upper.includes("FROM MESSAGES")) {
      const [threadId] = args;
      const rows = this.db.table("messages").filter((r) => r.threadId === threadId);
      if (upper.includes("ORDER BY TIMESTAMP ASC")) {
        rows.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
      }
      return rows;
    }

    if (upper.includes("FROM EXCEL_DATA")) {
      const [fileId, limit = Number.MAX_SAFE_INTEGER, offset = 0] = args;
      const rows = this.db
        .table("excel_data")
        .filter((r) => r.file_id === fileId)
        .sort((a, b) => (a.row_index ?? 0) - (b.row_index ?? 0));
      return rows.slice(offset, offset + limit);
    }

    if (upper.includes("FROM MIGRATIONS")) {
      let rows = [...this.db.table("migrations")];
      if (upper.includes("ORDER BY VERSION DESC")) {
        rows.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
      } else if (upper.includes("ORDER BY VERSION")) {
        rows.sort((a, b) => (a.version ?? 0) - (b.version ?? 0));
      }
      return rows;
    }

    if (upper.includes("FROM EXCEL_FILES")) {
      return [...this.db.table("excel_files")];
    }

    return [];
  }

  get(...args: any[]): Row | undefined {
    const upper = this.sql.toUpperCase();

    if (upper.includes("FROM THREADS")) {
      if (upper.includes("WHERE ID")) {
        const [id] = args;
        return this.db.table("threads").find((r) => r.id === id);
      }
      if (upper.includes("WHERE TITLE")) {
        const [title] = args;
        return this.db.table("threads").find((r) => r.title === title);
      }
      return this.db.table("threads")[0];
    }

    if (upper.includes("FROM MESSAGES")) {
      if (upper.includes("WHERE ID")) {
        const [id] = args;
        return this.db.table("messages").find((r) => r.id === id);
      }
      if (upper.includes("WHERE THREADID")) {
        const [threadId] = args;
        return this.db.table("messages").find((r) => r.threadId === threadId);
      }
      return this.db.table("messages")[0];
    }

    if (upper.includes("FROM EXCEL_FILES")) {
      if (upper.includes("WHERE ID")) {
        const [id] = args;
        return this.db.table("excel_files").find((r) => r.id === id);
      }
      return this.db.table("excel_files")[0];
    }

    if (upper.includes("FROM MIGRATIONS")) {
      if (upper.includes("COUNT(*)")) {
        return { count: this.db.table("migrations").length };
      }
      if (upper.includes("MAX(VERSION)")) {
        const rows = this.db.table("migrations");
        const max = rows.reduce((acc, r) => Math.max(acc, r.version ?? 0), 0);
        return { version: rows.length === 0 ? null : max };
      }
      if (upper.includes("WHERE VERSION")) {
        const [version] = args;
        return this.db.table("migrations").find((r) => r.version === version);
      }
      return this.db.table("migrations")[0];
    }

    if (upper.includes("FROM EXCEL_DATA")) {
      if (upper.includes("WHERE FILE_ID") && upper.includes("ROW_INDEX")) {
        const [fileId, rowIndex] = args;
        return this.db
          .table("excel_data")
          .find((r) => r.file_id === fileId && r.row_index === rowIndex);
      }
      if (upper.includes("WHERE ID")) {
        const [id] = args;
        return this.db.table("excel_data").find((r) => r.id === id);
      }
      if (upper.includes("WHERE FILE_ID")) {
        const [fileId] = args;
        return this.db.table("excel_data").find((r) => r.file_id === fileId);
      }
    }

    if (upper.includes("COUNT(*) AS COUNT")) {
      return { count: 0 };
    }

    if (upper.includes("FROM SQLITE_MASTER")) {
      const typeMatch = this.sql.match(/type\s*=\s*'(\w+)'/i);
      const nameMatch = this.sql.match(/name\s*=\s*'([^']+)'/i);
      const likeMatch = this.sql.match(/name\s+LIKE\s+'([^']+)'/i);
      if (typeMatch && typeMatch[1].toLowerCase() === "table" && nameMatch) {
        const name = nameMatch[1];
        return this.db.hasTable(name) ? { name } : undefined;
      }
      if (typeMatch && typeMatch[1].toLowerCase() === "index") {
        if (nameMatch) {
          const name = nameMatch[1];
          return this.db.indexes().includes(name) ? { name } : undefined;
        }
        if (likeMatch) {
          const pattern = likeMatch[1].replace(/%/g, "");
          const index = this.db.indexes().find((i) => i.includes(pattern));
          return index ? { name: index } : undefined;
        }
      }
    }

    return undefined;
  }
}

export class Database {
  private tables: Map<string, Row[]>;
  private counters: Map<string, number>;
  private tableNames: Set<string>;
  private indexNames: Set<string>;
  filename: string;

  constructor(filename: string) {
    this.filename = filename;
    this.tables = new Map();
    this.counters = new Map();
    this.tableNames = new Set();
    this.indexNames = new Set();
  }

  table(name: string): Row[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
      this.counters.set(name, 0);
    }
    return this.tables.get(name)!;
  }

  setTable(name: string, rows: Row[]) {
    this.tables.set(name, rows);
  }

  hasTable(name: string): boolean {
    return this.tableNames.has(name);
  }

  indexes(): string[] {
    return Array.from(this.indexNames);
  }

  tablesList(): string[] {
    return Array.from(this.tableNames);
  }

  nextId(name: string): number {
    const next = (this.counters.get(name) ?? 0) + 1;
    this.counters.set(name, next);
    return next;
  }

  prepare(sql: string) {
    return new Statement(this, sql);
  }

  exec(sql: string) {
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    statements.forEach((stmt) => {
      const upper = stmt.toUpperCase();
      if (upper.includes("INVALID SQL")) {
        throw new Error("Invalid SQL (mock)");
      }
      if (upper.startsWith("DELETE FROM THREADS")) {
        this.setTable("threads", []);
        this.setTable("messages", []);
      } else if (upper.startsWith("DELETE FROM MESSAGES")) {
        this.setTable("messages", []);
      } else if (upper.startsWith("DELETE FROM EXCEL_FILES")) {
        const parts = stmt.match(/WHERE\s+ID\s*=\s*(\d+)/i);
        if (parts) {
          const id = Number(parts[1]);
          this.setTable(
            "excel_files",
            this.table("excel_files").filter((r) => r.id !== id)
          );
          this.setTable(
            "excel_data",
            this.table("excel_data").filter((r) => r.file_id !== id)
          );
        } else {
          this.setTable("excel_files", []);
        }
      } else if (upper.startsWith("DELETE FROM EXCEL_DATA")) {
        this.setTable("excel_data", []);
      } else if (upper.startsWith("CREATE TABLE")) {
        const match = stmt.match(/CREATE TABLE IF NOT EXISTS\s+([^\s(]+)/i);
        if (match) {
          const name = match[1];
          this.tableNames.add(name);
          this.table(name);
        }
      } else if (upper.startsWith("CREATE INDEX")) {
        const match = stmt.match(/CREATE INDEX IF NOT EXISTS\s+([^\s(]+)/i);
        if (match) {
          this.indexNames.add(match[1]);
        }
      }
      // CREATE TABLE / PRAGMA / TRANSACTION statements are no-ops for the mock
    });
  }

  close() {
    // no-op for mock
  }
}

export default Database;

